import type { Job, JobStatus, StorageAdapter } from "../types";

export interface RedisConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  prefix?: string;
  maxRetries?: number;
}

export class RedisStorage implements StorageAdapter {
  private client: any; // ioredis instance
  private prefix: string;
  private connected = false;

  constructor(config: RedisConfig) {
    // Dynamic require — only loads ioredis when this adapter is used
    const Redis = require("ioredis").default || require("ioredis");
    this.prefix = config.prefix || "jetqueue";

    if (config.connectionString) {
      this.client = new Redis(config.connectionString, {
        maxRetriesPerRequest: config.maxRetries ?? 3,
        lazyConnect: true,
      });
    } else {
      this.client = new Redis({
        host: config.host || "localhost",
        port: config.port || 6379,
        password: config.password,
        db: config.db || 0,
        maxRetriesPerRequest: config.maxRetries ?? 3,
        lazyConnect: true,
      });
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    await this.client.connect();
    this.connected = true;
  }

  private key(jobId: string): string {
    return `${this.prefix}:job:${jobId}`;
  }

  private indexKey(status?: JobStatus): string {
    return status
      ? `${this.prefix}:index:${status}`
      : `${this.prefix}:index:all`;
  }

  private serialize(job: Job): Record<string, string> {
    return {
      id: job.id,
      name: job.name,
      data: JSON.stringify(job.data),
      status: job.status,
      priority: job.priority,
      attempts: String(job.attempts),
      maxAttempts: String(job.maxAttempts),
      timeout: String(job.timeout),
      delay: String(job.delay),
      createdAt: String(job.createdAt),
      startedAt: job.startedAt ? String(job.startedAt) : "",
      completedAt: job.completedAt ? String(job.completedAt) : "",
      progress: String(job.progress),
      error: job.error || "",
      result: job.result !== undefined ? JSON.stringify(job.result) : "",
      tags: JSON.stringify(job.tags),
      metadata: JSON.stringify(job.metadata),
    };
  }

  private deserialize(data: Record<string, string>): Job {
    return {
      id: data.id,
      name: data.name,
      data: JSON.parse(data.data || "{}"),
      status: data.status as JobStatus,
      priority: data.priority as Job["priority"],
      attempts: Number(data.attempts),
      maxAttempts: Number(data.maxAttempts),
      timeout: Number(data.timeout),
      delay: Number(data.delay),
      createdAt: Number(data.createdAt),
      startedAt: data.startedAt ? Number(data.startedAt) : undefined,
      completedAt: data.completedAt ? Number(data.completedAt) : undefined,
      progress: Number(data.progress),
      error: data.error || undefined,
      result: data.result ? JSON.parse(data.result) : undefined,
      tags: JSON.parse(data.tags || "[]"),
      metadata: JSON.parse(data.metadata || "{}"),
    };
  }

  async saveJob(job: Job): Promise<void> {
    await this.ensureConnected();
    const data = this.serialize(job);
    const jobKey = this.key(job.id);

    // Store job as hash
    await this.client.hset(jobKey, data);

    // Add to status index
    const statusKey = this.indexKey(job.status);
    await this.client.zadd(statusKey, job.createdAt, job.id);

    // Add to global index
    await this.client.zadd(this.indexKey(), job.createdAt, job.id);
  }

  async getJob(jobId: string): Promise<Job | null> {
    await this.ensureConnected();
    const data = await this.client.hgetall(this.key(jobId));

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this.deserialize(data);
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const current = await this.getJob(jobId);
    if (!current) return;

    const oldStatus = current.status;
    const merged = { ...current, ...updates };

    // Save updated job
    await this.saveJob(merged);

    // If status changed, update indexes
    if (updates.status && updates.status !== oldStatus) {
      const oldIndexKey = this.indexKey(oldStatus);
      await this.client.zrem(oldIndexKey, jobId);
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    await this.ensureConnected();

    const job = await this.getJob(jobId);
    if (!job) return;

    // Remove from indexes
    await this.client.zrem(this.indexKey(job.status), jobId);
    await this.client.zrem(this.indexKey(), jobId);

    // Remove job data
    await this.client.del(this.key(jobId));
  }

  async listJobs(status?: JobStatus): Promise<Job[]> {
    await this.ensureConnected();

    const indexKey = this.indexKey(status);
    const ids = await this.client.zrange(indexKey, 0, -1);

    if (ids.length === 0) return [];

    // Fetch all jobs in pipeline
    const pipeline = this.client.pipeline();
    ids.forEach((id: string) => pipeline.hgetall(this.key(id)));

    const results = await pipeline.exec();
    return results
      .map(([err, data]: [any, any]) => {
        if (err || !data || Object.keys(data).length === 0) return null;
        return this.deserialize(data);
      })
      .filter(Boolean);
  }

  async clearAll(): Promise<void> {
    await this.ensureConnected();

    // Get all job keys
    const keys = await this.client.keys(`${this.prefix}:job:*`);
    const indexKeys = await this.client.keys(`${this.prefix}:index:*`);

    const allKeys = [...keys, ...indexKeys];
    if (allKeys.length > 0) {
      await this.client.del(...allKeys);
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }
}
