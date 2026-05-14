import { Hono } from "hono";
import { JobsController } from "../controllers/jobs.controller";

const jobsController = new JobsController();
export const jobs = new Hono();

// POST /api/jobs - Create a new job
jobs.post("/", (c) => jobsController.createJob(c));

// GET /api/jobs/:id - Get job details
jobs.get("/:id", (c) => jobsController.getJob(c));

// GET /api/jobs/:id/progress - Get job progress only
jobs.get("/:id/progress", (c) => jobsController.getJobProgress(c));

// DELETE /api/jobs/:id - Cancel a job
jobs.delete("/:id", (c) => jobsController.cancelJob(c));

// POST /api/jobs/:id/retry - Retry a failed job
jobs.post("/:id/retry", (c) => jobsController.retryJob(c));
