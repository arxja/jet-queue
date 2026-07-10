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
  private connectingPromise: Promise<void> | null = null;

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

    // If already connecting, reuse the same promise
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = this.client
      .connect()
      .then(() => {
        this.connected = true;
      })
      .finally(() => {
        this.connectingPromise = null;
      });

    return this.connectingPromise!;
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
    const statusKey = this.indexKey(job.status);
    const allKey = this.indexKey();

    const multi = this.client.multi();
    multi.hset(jobKey, data);
    multi.zadd(statusKey, job.createdAt, job.id);
    multi.zadd(allKey, job.createdAt, job.id);
    await multi.exec();
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
    const data = this.serialize(merged);
    const jobKey = this.key(jobId);

    const multi = this.client.multi();
    multi.hset(jobKey, data);

    // If status changed, remove from old index
    if (updates.status && updates.status !== oldStatus) {
      multi.zrem(this.indexKey(oldStatus), jobId);
    }

    // Always re-add to new status index and global index
    multi.zadd(this.indexKey(merged.status), merged.createdAt, jobId);
    multi.zadd(this.indexKey(), merged.createdAt, jobId);

    await multi.exec();
  }

  async deleteJob(jobId: string): Promise<void> {
    await this.ensureConnected();

    const job = await this.getJob(jobId);
    if (!job) return;

    const jobKey = this.key(jobId);

    const multi = this.client.multi();
    multi.zrem(this.indexKey(job.status), jobId);
    multi.zrem(this.indexKey(), jobId);
    multi.del(jobKey);
    await multi.exec();
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

    const patterns = [`${this.prefix}:job:*`, `${this.prefix}:index:*`];

    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
      this.connectingPromise = null;
    }
  }
}
