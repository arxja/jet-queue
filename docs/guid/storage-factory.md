# JetQueue - Storage system

JetQueue supports multiple storage backends for persisting jobs. Choose the one that fits your environment — from zero-config memory storage for development, to PostgreSQL and Redis for production.

## Quick Start

JetQueue automatically detects your storage configuration. The simplest setup:

``` Using a configuration file (.jetqueuerc.json)
{
  "storage": {
    "type": "sqlite",
    "sqlite": {
      "filename": "./jetqueue.db"
    }
  }
}
```

Or set it via environment variables:

``` bash
export JETQUEUE_STORAGE_TYPE=postgres
export DATABASE_URL=postgresql://user:pass@localhost:5432/jetqueue
```

## Available Backends

| Backend | Best For | Dependencies |
|---------|----------|--------------|
| `memory` | Development, testing, ephemeral jobs | None (built-in) |
| `sqlite` | Single-server apps, dev environments | None (uses Bun/Node built-in) |
| `postgres` | Production, multi-server, high durability | `pg` (install separately) |
| `redis` | Production, high-throughput, distributed | `ioredis` (install separately) |

---

## Memory Storage

Keeps all jobs in process memory. Fastest option, but jobs are lost on restart.

### Configuration

``` .jetqueuerc.json
{
  "storage": {
    "type": "memory"
  }
}
```

### Environment Variables

``` bash
export JETQUEUE_STORAGE_TYPE=memory
```

### Usage Notes

- No persistence — all jobs lost on process exit
- No external dependencies
- Ideal for testing and development
- Default if no storage is configured

---

## SQLite Storage

File-based or in-memory SQLite database. Works with both Bun (native `bun:sqlite`) and Node.js 22+ (native `node:sqlite`). No external dependencies required.

### Configuration

``` .jetqueuerc.json
{
  "storage": {
    "type": "sqlite",
    "sqlite": {
      "filename": "./data/jetqueue.db"
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sqlite.filename` | `string` | `":memory:"` | Path to the database file. Use `:memory:` for ephemeral storage |

### Environment Variables

``` bash
export JETQUEUE_STORAGE_TYPE=sqlite
export JETQUEUE_SQLITE_FILENAME=./data/jetqueue.db
```

### Usage Notes

- For Bun: uses built-in `bun:sqlite`
- For Node.js 22.5+: uses built-in `node:sqlite`
- Enables WAL journal mode by default for better concurrency
- Great for single-server deployments with moderate job volume

---

## PostgreSQL Storage

Full PostgreSQL support for production workloads. Uses connection pooling and supports custom schemas.

### Prerequisites

Install the `pg` package:

``` bash
npm install pg
# or
bun add pg
```

### Configuration

``` .jetqueuerc.json
{
  "storage": {
    "type": "postgres",
    "postgres": {
      "connectionString": "postgresql://user:password@localhost:5432/jetqueue"
    }
  }
}
```

Or with individual connection parameters:

``` .jetqueuerc.json
{
  "storage": {
    "type": "postgres",
    "postgres": {
      "host": "localhost",
      "port": 5432,
      "database": "jetqueue",
      "username": "postgres",
      "password": "your-password",
      "schema": "jetqueue"
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `postgres.connectionString` | `string` | — | Full PostgreSQL connection URI |
| `postgres.host` | `string` | `"localhost"` | Database host |
| `postgres.port` | `number` | `5432` | Database port |
| `postgres.database` | `string` | `"jetqueue"` | Database name |
| `postgres.username` | `string` | — | Database user |
| `postgres.password` | `string` | — | Database password |
| `postgres.schema` | `string` | `"public"` | Schema name for JetQueue tables |

### Environment Variables

#### Connection String (recommended)

``` bash
export JETQUEUE_STORAGE_TYPE=postgres
export DATABASE_URL=postgresql://user:pass@localhost:5432/jetqueue
# or
export JETQUEUE_POSTGRES_CONNECTION_STRING=postgresql://user:pass@localhost:5432/jetqueue
```

#### Individual Parameters

``` bash
export JETQUEUE_STORAGE_TYPE=postgres
export JETQUEUE_POSTGRES_HOST=localhost
export JETQUEUE_POSTGRES_PORT=5432
export JETQUEUE_POSTGRES_DATABASE=jetqueue
export JETQUEUE_POSTGRES_USERNAME=postgres
export JETQUEUE_POSTGRES_PASSWORD=your-password
export JETQUEUE_POSTGRES_SCHEMA=jetqueue
```

### Usage Notes

- Automatically creates the schema and `jobs` table on first use
- Uses `ON CONFLICT (id) DO UPDATE` (upsert) for `saveJob`
- Schema names are validated and escaped to prevent SQL injection
- Connection pooling via `pg.Pool` for efficient resource use
- Best choice for multi-server deployments and high durability requirements

---

## Redis Storage

Redis-backed storage using hashes for job data and sorted sets for status-based indexing. Optimized for high-throughput, distributed workloads.

### Prerequisites

Install the `ioredis` package:

``` bash
npm install ioredis
# or
bun add ioredis
```

### Configuration

``` .jetqueuerc.json
{
  "storage": {
    "type": "redis",
    "redis": {
      "connectionString": "redis://localhost:6379"
    }
  }
}
```

Or with individual connection parameters:

``` .jetqueuerc.json
{
  "storage": {
    "type": "redis",
    "redis": {
      "host": "localhost",
      "port": 6379,
      "password": "your-password",
      "db": 0,
      "prefix": "jetqueue",
      "maxRetries": 3
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redis.connectionString` | `string` | — | Full Redis connection URI |
| `redis.host` | `string` | `"localhost"` | Redis host |
| `redis.port` | `number` | `6379` | Redis port |
| `redis.password` | `string` | — | Redis password (if required) |
| `redis.db` | `number` | `0` | Redis database number |
| `redis.prefix` | `string` | `"jetqueue"` | Key prefix for all JetQueue keys |
| `redis.maxRetries` | `number` | `3` | Max retries per request |

### Environment Variables

#### Connection String (recommended)

``` bash
export JETQUEUE_STORAGE_TYPE=redis
export REDIS_URL=redis://localhost:6379
# or
export JETQUEUE_REDIS_CONNECTION_STRING=redis://localhost:6379
```

#### Individual Parameters

``` bash
export JETQUEUE_STORAGE_TYPE=redis
export JETQUEUE_REDIS_HOST=localhost
export JETQUEUE_REDIS_PORT=6379
export JETQUEUE_REDIS_PASSWORD=your-password
export JETQUEUE_REDIS_DB=0
export JETQUEUE_REDIS_PREFIX=jetqueue
export JETQUEUE_REDIS_MAX_RETRIES=3
```

### Data Structure

Each job is stored as a Redis hash at `{prefix}:job:{jobId}`. Status-based indexes use sorted sets:

- `{prefix}:index:pending` — Jobs awaiting execution
- `{prefix}:index:running` — Jobs currently executing
- `{prefix}:index:completed` — Successfully completed jobs
- `{prefix}:index:failed` — Permanently failed jobs
- `{prefix}:index:delayed` — Jobs scheduled for later
- `{prefix}:index:all` — Global index of all jobs

### Usage Notes

- Uses `MULTI/EXEC` transactions for atomic write operations
- `clearAll()` uses cursor-based `SCAN` to avoid blocking the Redis server
- Lazy connection — connects on first operation
- Concurrent `ensureConnected()` calls share a single connection promise
- Score in sorted sets is `createdAt` timestamp, enabling chronological queries
- Best choice for high-throughput systems, microservices, and distributed architectures

---

## Custom Storage Adapter

You can implement your own storage adapter by implementing the `StorageAdapter` interface:

``` typescript
import type { StorageAdapter, Job, JobStatus } from "jetqueue";

class MyCustomStorage implements StorageAdapter {
  async saveJob(job: Job): Promise<void> { ... }
  async getJob(jobId: string): Promise<Job | null> { ... }
  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> { ... }
  async deleteJob(jobId: string): Promise<void> { ... }
  async listJobs(status?: JobStatus): Promise<Job[]> { ... }
  async clearAll(): Promise<void> { ... }
  async close(): Promise<void> { ... }
}
```

Then pass your adapter directly to the queue:

``` typescript
import { JetQueue } from "jetqueue";

const queue = new JetQueue(
  { concurrency: 5 },
  new MyCustomStorage()
);
```

---

## Programmatic Usage

Bypass configuration files and pass a storage adapter directly:

``` typescript
import { JetQueue } from "jetqueue";
import { PostgresStorage } from "jetqueue/storage/postgres";

const storage = new PostgresStorage({
  connectionString: process.env.DATABASE_URL,
});

const queue = new JetQueue({ concurrency: 10 }, storage);
```

Or use the static factory method with auto-detection:

``` typescript
import { JetQueue } from "jetqueue";

// Reads .jetqueuerc.*, environment variables, and creates the right storage
const queue = await JetQueue.create();
```

---

## Configuration Precedence

JetQueue resolves storage configuration in this order (highest priority first):

1. **Programmatic override** — Passing a `StorageAdapter` directly to `new JetQueue()`
2. **Environment variables** — `JETQUEUE_*` and standard `DATABASE_URL` / `REDIS_URL`
3. **Configuration file** — `.jetqueuerc.json`, `jetqueue.config.js`, etc.
4. **Default** — `memory` storage (if nothing is configured)

---

## Choosing a Backend

| Scenario | Recommended Backend |
|----------|-------------------|
| Local development | `memory` or `sqlite` |
| Testing / CI | `memory` |
| Single-server production | `sqlite` or `postgres` |
| Multi-server / distributed | `postgres` or `redis` |
| High throughput (>1000 jobs/sec) | `redis` |
| Audit trail / long-term history | `postgres` |
| Ephemeral / cache-like jobs | `redis` |