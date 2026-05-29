import type { Job, JobStatus, StorageAdapter } from "../types";

// Detect runtime
const isBun = typeof Bun !== "undefined" && !!Bun.version;
const isNode = typeof process !== "undefined" && process.versions?.node;

let SQLiteStorageClass: any;

if (isBun) {
  // Bun: Use native bun:sqlite
  const { Database } = await import("bun:sqlite");

  SQLiteStorageClass = class BunSQLiteStorage implements StorageAdapter {
    private db: any;

    constructor(filename = ":memory:") {
      this.db = new Database(filename);
      this.db.run("PRAGMA journal_mode = WAL");
      this.initialize();
    }

    private initialize(): void {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          data TEXT DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'pending',
          priority TEXT NOT NULL DEFAULT 'normal',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 1,
          timeout INTEGER NOT NULL DEFAULT 30000,
          delay INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,
          progress INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          result TEXT,
          tags TEXT DEFAULT '[]',
          metadata TEXT DEFAULT '{}'
        )
      `);

      this.db.run("CREATE INDEX IF NOT EXISTS idx_status ON jobs(status)");
      this.db.run("CREATE INDEX IF NOT EXISTS idx_priority ON jobs(priority)");
    }

    private serialize(job: Job): Record<string, any> {
      return {
        id: job.id,
        name: job.name,
        data: JSON.stringify(job.data),
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        max_attempts: job.maxAttempts,
        timeout: job.timeout,
        delay: job.delay,
        created_at: job.createdAt,
        started_at: job.startedAt || null,
        completed_at: job.completedAt || null,
        progress: job.progress,
        error: job.error || null,
        result: job.result === undefined ? null : JSON.stringify(job.result),
        tags: JSON.stringify(job.tags),
        metadata: JSON.stringify(job.metadata),
      };
    }

    private deserialize(row: any): Job {
      return {
        id: row.id,
        name: row.name,
        data: JSON.parse(row.data),
        status: row.status as JobStatus,
        priority: row.priority,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        timeout: row.timeout,
        delay: row.delay,
        createdAt: row.created_at,
        startedAt: row.started_at ?? undefined,
        completedAt: row.completed_at ?? undefined,
        progress: row.progress,
        error: row.error ?? undefined,
        result: row.result === null ? undefined : JSON.parse(row.result),
        tags: JSON.parse(row.tags),
        metadata: JSON.parse(row.metadata),
      };
    }

    async saveJob(job: Job): Promise<void> {
      const s = this.serialize(job);
      this.db.run(
        `INSERT OR REPLACE INTO jobs 
        (id, name, data, status, priority, attempts, max_attempts, timeout, delay,
         created_at, started_at, completed_at, progress, error, result, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.name,
          s.data,
          s.status,
          s.priority,
          s.attempts,
          s.max_attempts,
          s.timeout,
          s.delay,
          s.created_at,
          s.started_at,
          s.completed_at,
          s.progress,
          s.error,
          s.result,
          s.tags,
          s.metadata,
        ],
      );
    }

    async getJob(jobId: string): Promise<Job | null> {
      const row = this.db.query("SELECT * FROM jobs WHERE id = ?").get(jobId);
      return row ? this.deserialize(row) : null;
    }

    async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
      const current = await this.getJob(jobId);
      if (!current) return;
      const merged = { ...current, ...updates };
      await this.saveJob(merged);
    }

    async deleteJob(jobId: string): Promise<void> {
      this.db.run("DELETE FROM jobs WHERE id = ?", [jobId]);
    }

    async listJobs(status?: JobStatus): Promise<Job[]> {
      let rows;
      if (status) {
        rows = this.db
          .query("SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC")
          .all(status);
      } else {
        rows = this.db
          .query("SELECT * FROM jobs ORDER BY created_at ASC")
          .all();
      }
      return rows.map((row: any) => this.deserialize(row));
    }

    async clearAll(): Promise<void> {
      this.db.run("DELETE FROM jobs");
    }

    async close(): Promise<void> {
      this.db.close();
    }
  };
} else if (isNode && parseInt(process.versions.node.split(".")[0]) >= 22) {
  // Node.js 22+: Use native node:sqlite
  const { DatabaseSync } = await import("node:sqlite");

  SQLiteStorageClass = class NodeSQLiteStorage implements StorageAdapter {
    private db: DatabaseSync;

    constructor(filename = ":memory:") {
      this.db = new DatabaseSync(filename);
      this.db.exec("PRAGMA journal_mode = WAL");
      this.initialize();
    }

    private initialize(): void {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          data TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          priority TEXT NOT NULL DEFAULT 'normal',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 1,
          timeout INTEGER NOT NULL DEFAULT 30000,
          delay INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,
          progress INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          result TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          metadata TEXT NOT NULL DEFAULT '{}'
        )
      `);

      this.db.exec("CREATE INDEX IF NOT EXISTS idx_status ON jobs(status)");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_priority ON jobs(priority)");
    }

    private serialize(job: Job): Record<string, any> {
      return {
        id: job.id,
        name: job.name,
        data: JSON.stringify(job.data),
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        max_attempts: job.maxAttempts,
        timeout: job.timeout,
        delay: job.delay,
        created_at: job.createdAt,
        started_at: job.startedAt ?? null,
        completed_at: job.completedAt ?? null,
        progress: job.progress,
        error: job.error ?? null,
        result: job.result === undefined ? null : JSON.stringify(job.result),
        tags: JSON.stringify(job.tags ?? []),
        metadata: JSON.stringify(job.metadata ?? {}),
      };
    }

    private deserialize(row: any): Job {
      return {
        id: row.id,
        name: row.name,
        data: JSON.parse(row.data),
        status: row.status as JobStatus,
        priority: row.priority,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        timeout: row.timeout,
        delay: row.delay,
        createdAt: row.created_at,
        startedAt: row.started_at ?? undefined,
        completedAt: row.completed_at ?? undefined,
        progress: row.progress,
        error: row.error ?? undefined,
        result: row.result === null ? undefined : JSON.parse(row.result),
        tags: JSON.parse(row.tags),
        metadata: JSON.parse(row.metadata),
      };
    }

    async saveJob(job: Job): Promise<void> {
      const s = this.serialize(job);
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO jobs 
        (id, name, data, status, priority, attempts, max_attempts, timeout, delay,
         created_at, started_at, completed_at, progress, error, result, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        s.id,
        s.name,
        s.data,
        s.status,
        s.priority,
        s.attempts,
        s.max_attempts,
        s.timeout,
        s.delay,
        s.created_at,
        s.started_at,
        s.completed_at,
        s.progress,
        s.error,
        s.result,
        s.tags,
        s.metadata,
      );
    }

    async getJob(jobId: string): Promise<Job | null> {
      const stmt = this.db.prepare("SELECT * FROM jobs WHERE id = ?");
      const row = stmt.get(jobId);
      return row ? this.deserialize(row) : null;
    }

    async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
      const current = await this.getJob(jobId);
      if (!current) return;
      const merged = { ...current, ...updates };
      await this.saveJob(merged);
    }

    async deleteJob(jobId: string): Promise<void> {
      const stmt = this.db.prepare("DELETE FROM jobs WHERE id = ?");
      stmt.run(jobId);
    }

    async listJobs(status?: JobStatus): Promise<Job[]> {
      let stmt;
      if (status) {
        stmt = this.db.prepare(
          "SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC",
        );
        const rows = stmt.all(status);
        return rows.map((row) => this.deserialize(row));
      } else {
        stmt = this.db.prepare("SELECT * FROM jobs ORDER BY created_at ASC");
        const rows = stmt.all();
        return rows.map((row) => this.deserialize(row));
      }
    }

    async clearAll(): Promise<void> {
      this.db.exec("DELETE FROM jobs");
    }

    async close(): Promise<void> {
      this.db.close();
    }
  };
} else {
  throw new Error(
    `SQLite storage requires either:\n` +
      `- Bun runtime\n` +
      `- Node.js 22.5 or higher (current: ${process.versions.node})\n` +
      `Please upgrade Node.js or use a different storage adapter.`,
  );
}

// Export the appropriate implementation
export const SQLiteStorage = SQLiteStorageClass;
