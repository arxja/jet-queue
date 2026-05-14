import type { Context } from "hono";
import { getQueue } from "../queue-manager";
import type { CreateJobRequest, JobResponse } from "../types";
import { QueueError } from "@job-queue-system/core";

export class JobsController {
  async createJob(c: Context) {
    try {
      const body = await c.req.json<CreateJobRequest>();

      if (!body.handler) {
        return c.json(
          { error: "handler is required", code: "VALIDATION_ERROR" },
          400,
        );
      }

      const queue = getQueue();

      const jobId = queue.add(body.handler, {
        data: body.data,
        priority: body.priority || "normal",
        delay: body.delay,
        timeout: body.timeout,
        maxAttempts: body.maxAttempts,
        retryOptions: body.retryStrategy
          ? {
              strategy: body.retryStrategy,
              delay: body.retryDelay || 1000,
            }
          : undefined,
        tags: body.tags,
      });

      const job = queue.getJob(jobId);

      return c.json(
        {
          id: jobId,
          name: job?.name || body.handler,
          status: job?.status || "pending",
          createdAt: new Date(job?.createdAt || Date.now()).toISOString(),
        },
        201,
      );
    } catch (error) {
      if (error instanceof QueueError) {
        return c.json({ error: error.message, code: error.code }, 400);
      }
      if (error instanceof Error && error.message.includes("not registered")) {
        return c.json({ error: error.message, code: "HANDLER_NOT_FOUND" }, 404);
      }
      throw error;
    }
  }

  async getJob(c: Context) {
    const jobId = c.req.param("id");
    const queue = getQueue();

    if (!jobId) {
      return c.json({ error: "Job ID is required", code: "BAD_REQUEST" }, 400);
    }

    const job = queue.getJob(jobId);

    if (!job) {
      return c.json({ error: "Job not found", code: "NOT_FOUND" }, 404);
    }

    const response: JobResponse = {
      id: job.id,
      name: job.name,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      progress: job.progress,
      createdAt: new Date(job.createdAt).toISOString(),
      startedAt: job.startedAt
        ? new Date(job.startedAt).toISOString()
        : undefined,
      completedAt: job.completedAt
        ? new Date(job.completedAt).toISOString()
        : undefined,
      error: job.error,
      data: job.data,
      result: job.result,
    };

    return c.json(response);
  }

  async getJobProgress(c: Context) {
    const jobId = c.req.param("id");
    const queue = getQueue();

    if (!jobId) {
      return c.json({ error: "Job ID is required", code: "BAD_REQUEST" }, 400);
    }

    const job = queue.getJob(jobId);

    if (!job) {
      return c.json({ error: "Job not found", code: "NOT_FOUND" }, 404);
    }

    return c.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
    });
  }

  async cancelJob(c: Context) {
    const jobId = c.req.param("id");
    const queue = getQueue();

    if (!jobId) {
      return c.json({ error: "Job ID is required", code: "BAD_REQUEST" }, 400);
    }

    const cancelled = queue.cancel(jobId);

    if (!cancelled) {
      return c.json(
        { error: "Job not found or cannot be cancelled", code: "NOT_FOUND" },
        404,
      );
    }

    return c.json({ id: jobId, status: "cancelled" });
  }

  async retryJob(c: Context) {
    const jobId = c.req.param("id");
    const queue = getQueue();

    if (!jobId) {
      return c.json({ error: "Job ID is required", code: "BAD_REQUEST" }, 400);
    }

    const retried = queue.retry(jobId);

    if (!retried) {
      return c.json(
        { error: "Job not found or cannot be retried", code: "CANNOT_RETRY" },
        400,
      );
    }

    return c.json({
      id: jobId,
      status: "pending",
      message: "Job queued for retry",
    });
  }
}
