import type { Job, JobStatus, StorageAdapter } from "../types";

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  schema?: string;
}

export class PostgresStorage implements StorageAdapter {
  private pool: any; // pg Pool
  private schema: string;
  private initialized = false;

  constructor(config: PostgresConfig) {
    // Dynamic import — only loads pg when this adapter is used
    // Bun handles this natively, Node needs pg installed
    const { Pool } = require("pg") as typeof import("pg");

    this.schema = config.schema || "public";

    this.pool = new Pool(
      config.connectionString
        ? { connectionString: config.connectionString }
        : {
            host: config.host || "localhost",
            port: config.port || 5432,
            database: config.database || "jetqueue",
            user: config.username,
            password: config.password,
          },
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        timeout INTEGER NOT NULL DEFAULT 30000,
        delay INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        started_at BIGINT,
        completed_at BIGINT,
        progress INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        result JSONB,
        tags JSONB NOT NULL DEFAULT '[]',
        metadata JSONB NOT NULL DEFAULT '{}'
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_status 
      ON ${this.schema}.jobs (status)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_priority 
      ON ${this.schema}.jobs (priority)
    `);

    this.initialized = true;
  }

  private serialize(job: Job): any[] {
    return [
      job.id,
      job.name,
      JSON.stringify(job.data),
      job.status,
      job.priority,
      job.attempts,
      job.maxAttempts,
      job.timeout,
      job.delay,
      job.createdAt,
      job.startedAt || null,
      job.completedAt || null,
      job.progress,
      job.error || null,
      job.result !== undefined ? JSON.stringify(job.result) : null,
      JSON.stringify(job.tags),
      JSON.stringify(job.metadata),
    ];
  }

  private deserialize(row: any): Job {
    return {
      id: row.id,
      name: row.name,
      data: row.data,
      status: row.status as JobStatus,
      priority: row.priority as Job["priority"],
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      timeout: row.timeout,
      delay: row.delay,
      createdAt: Number(row.created_at),
      startedAt: row.started_at ? Number(row.started_at) : undefined,
      completedAt: row.completed_at ? Number(row.completed_at) : undefined,
      progress: row.progress,
      error: row.error || undefined,
      result: row.result || undefined,
      tags: row.tags || [],
      metadata: row.metadata || {},
    };
  }

  async saveJob(job: Job): Promise<void> {
    await this.ensureInitialized();

    const values = this.serialize(job);
    await this.pool.query(
      `INSERT INTO ${this.schema}.jobs 
       (id, name, data, status, priority, attempts, max_attempts, timeout, delay,
        created_at, started_at, completed_at, progress, error, result, tags, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         data = EXCLUDED.data,
         status = EXCLUDED.status,
         priority = EXCLUDED.priority,
         attempts = EXCLUDED.attempts,
         max_attempts = EXCLUDED.max_attempts,
         timeout = EXCLUDED.timeout,
         delay = EXCLUDED.delay,
         created_at = EXCLUDED.created_at,
         started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at,
         progress = EXCLUDED.progress,
         error = EXCLUDED.error,
         result = EXCLUDED.result,
         tags = EXCLUDED.tags,
         metadata = EXCLUDED.metadata`,
      values,
    );
  }

  async getJob(jobId: string): Promise<Job | null> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT * FROM ${this.schema}.jobs WHERE id = $1`,
      [jobId],
    );

    return result.rows[0] ? this.deserialize(result.rows[0]) : null;
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const current = await this.getJob(jobId);
    if (!current) return;

    const merged = { ...current, ...updates };
    await this.saveJob(merged);
  }

  async deleteJob(jobId: string): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query(`DELETE FROM ${this.schema}.jobs WHERE id = $1`, [
      jobId,
    ]);
  }

  async listJobs(status?: JobStatus): Promise<Job[]> {
    await this.ensureInitialized();

    let result;
    if (status) {
      result = await this.pool.query(
        `SELECT * FROM ${this.schema}.jobs WHERE status = $1 ORDER BY created_at ASC`,
        [status],
      );
    } else {
      result = await this.pool.query(
        `SELECT * FROM ${this.schema}.jobs ORDER BY created_at ASC`,
      );
    }

    return result.rows.map((row: any) => this.deserialize(row));
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(`DELETE FROM ${this.schema}.jobs`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
