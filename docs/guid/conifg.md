# JetQueue - Configuration System

JetQueue's configuration system is designed to be **modular**, **type‑safe**, and **developer‑friendly**.  
Each package can register its own configuration schema, allowing intelligent autocomplete and validation while keeping the core lean.

---

## Overview

- **Plugin‑based** – Every package (server, dashboard, etc.) contributes its own `ZodObject` schema via a central registry.
- **Single source of truth** – Configuration is loaded once via `cosmiconfig` and validated against the combined schema (base + all registered plugins).
- **Environment variables** – All settings can be overridden with `JETQUEUE_*` or backend‑specific variables (e.g. `DATABASE_URL`). Environment values take precedence over file values.
- **Type‑safe** – The exported `baseConfigSchema` and helper functions give you full TypeScript inference, and the combined schema adapts to registered plugins.
- **Deep merging** – Configuration from files and environment variables are deeply merged, so you can override nested properties while preserving others.
- **Robust validation** – Zod provides detailed error messages, and the loader prints a clear list of issues when validation fails.

---

## Configuration File

JetQueue looks for a configuration file in your project root using **cosmiconfig**.  
Supported formats:

- `jetqueue.config.js` / `jetqueue.config.ts`
- `jetqueue.config.cjs` / `jetqueue.config.mjs`
- `.jetqueuerc`, `.jetqueuerc.json`, `.jetqueuerc.yaml`, `.jetqueuerc.yml`
- `.jetqueuerc.js` / `.jetqueuerc.cjs` / `.jetqueuerc.mjs`
- `package.json` (under the `"jetqueue"` key)

### Example `jetqueue.config.ts`

///ts
import type { JetQueueConfig } from "@jetqueue/core";

export const config: JetQueueConfig = {
queue: {
concurrency: 5,
maxQueuedJobs: 10000,
autoStart: true,
defaultJobOptions: {
priority: "normal",
timeout: 30000,
maxAttempts: 3,
retryOptions: {
strategy: "exponential",
delay: 1000,
maxDelay: 60000,
},
},
},
storage: {
type: "postgres",
postgres: {
host: "localhost",
port: 5432,
database: "jetqueue",
username: "postgres",
password: "postgres",
pool: { min: 2, max: 10 },
},
},
};
///

If you are using JavaScript, you can omit the type annotation.

---

## Base Configuration Sections

### `queue`

| Property            | Type                | Default   | Description                                                 |
| ------------------- | ------------------- | --------- | ----------------------------------------------------------- |
| `concurrency`       | `number` (positive) | `5`       | Number of jobs processed simultaneously.                    |
| `maxQueuedJobs`     | `number` (positive) | `10000`   | Maximum number of jobs allowed in the queue (backpressure). |
| `autoStart`         | `boolean`           | `true`    | Whether the queue starts processing immediately.            |
| `defaultJobOptions` | `JobOptions`        | See below | Default options applied to every job.                       |

#### `JobOptions`

| Property       | Type                                        | Default    | Description                                    |
| -------------- | ------------------------------------------- | ---------- | ---------------------------------------------- |
| `priority`     | `"low" \| "normal" \| "high" \| "critical"` | `"normal"` | Job priority.                                  |
| `timeout`      | `number` (ms, positive)                     | `30000`    | Time after which a job is considered failed.   |
| `maxAttempts`  | `number` (positive integer)                 | `3`        | Number of retry attempts before final failure. |
| `retryOptions` | `RetryOptions`                              | See below  | Retry strategy configuration.                  |

#### `RetryOptions`

| Property   | Type                                   | Default         | Description                                        |
| ---------- | -------------------------------------- | --------------- | -------------------------------------------------- |
| `strategy` | `"fixed" \| "linear" \| "exponential"` | `"exponential"` | Retry backoff algorithm.                           |
| `delay`    | `number` (ms, positive)                | `1000`          | Base delay between retries.                        |
| `maxDelay` | `number` (ms, positive, optional)      | `60000`         | Maximum delay cap (applies to exponential/linear). |

---

### `storage`

A **discriminated union** – you must specify `type` and provide the corresponding configuration object.

#### `type: "postgres"`

| Property           | Type                             | Default               | Description                                        |
| ------------------ | -------------------------------- | --------------------- | -------------------------------------------------- |
| `host`             | `string` (optional)              | –                     | PostgreSQL host.                                   |
| `port`             | `number` (1‑65535, optional)     | –                     | PostgreSQL port.                                   |
| `database`         | `string` (optional)              | –                     | Database name.                                     |
| `username`         | `string` (optional)              | –                     | Username.                                          |
| `password`         | `string` (optional)              | –                     | Password.                                          |
| `connectionString` | `string` (optional)              | –                     | Full connection string (overrides host/port/etc.). |
| `pool`             | `{ min?: number, max?: number }` | `{ min: 2, max: 10 }` | Connection pool limits.                            |
| `schema`           | `string` (optional)              | –                     | PostgreSQL schema name.                            |

> **Validation:** Either `connectionString` or both `host` and `database` must be provided.

#### `type: "redis"`

| Property           | Type                         | Default       | Description                       |
| ------------------ | ---------------------------- | ------------- | --------------------------------- |
| `host`             | `string` (optional)          | `"localhost"` | Redis host.                       |
| `port`             | `number` (1‑65535, optional) | `6379`        | Redis port.                       |
| `password`         | `string` (optional)          | –             | Redis password.                   |
| `db`               | `number` (≥0)                | `0`           | Redis database index.             |
| `connectionString` | `string` (optional)          | –             | Full Redis URL.                   |
| `prefix`           | `string`                     | `"jetqueue:"` | Key prefix for all JetQueue keys. |
| `maxRetries`       | `number` (≥0)                | `3`           | Connection retry attempts.        |

> **Validation:** Either `connectionString` or both `host` and `port` must be provided.

#### `type: "sqlite"`

| Property      | Type      | Default      | Description                                       |
| ------------- | --------- | ------------ | ------------------------------------------------- |
| `filename`    | `string`  | `":memory:"` | Path to the SQLite database file.                 |
| `wal`         | `boolean` | `true`       | Enable Write‑Ahead Logging.                       |
| `busyTimeout` | `number`  | `5000`       | Milliseconds to wait when the database is locked. |

#### `type: "memory"`

No additional properties – an in‑memory storage backend (useful for testing).

---

## Plugin Configuration

Packages can extend the configuration by registering their own `ZodObject` schema.

### Registering a Plugin Schema

Inside your plugin package, call:

///ts
import { registerConfigSchema } from "@jetqueue/core";
import { z } from "zod";

const pluginSchema = z.object({
dashboard: z.object({
port: z.number().default(3000),
auth: z.object({
username: z.string(),
password: z.string().min(8),
}),
}),
});

registerConfigSchema("dashboard", pluginSchema);
///

Now users can include `dashboard` in their configuration:

///ts
export default {
queue: {
/_ ... _/
},
storage: {
/_ ... _/
},
dashboard: {
port: 8080,
auth: {
username: "admin",
password: "supersecure",
},
},
};
///

The plugin’s section is automatically validated and typed. The combined schema is built at runtime by merging the base schema with all registered plugin schemas.

---

## Loading Configuration

Use the provided `ConfigLoader` (singleton) or the convenience `loadConfig()` function.

///ts
import { loadConfig } from "@jetqueue/core";

const config = await loadConfig();
console.log(config.queue.concurrency);
console.log(config.storage.type);
///

You can also access specific sections:

///ts
const loader = ConfigLoader.getInstance();
await loader.load();

const queue = loader.getQueueConfig();
const storage = loader.getStorageConfig();
const dashboard = loader.getPluginConfig("dashboard");
///

The loader performs the following steps:

1. Searches for a configuration file using `cosmiconfig`.
2. Merges environment variables (with deep merge) into the file configuration.
3. Applies the combined Zod schema (base + registered plugins) to validate the final config.
4. On success, stores the validated config internally and provides accessor methods.

---

## Environment Variables

All configuration values can be overridden with environment variables. This is useful for 12‑factor apps and CI/CD.

| Variable                                               | Description                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `JETQUEUE_CONCURRENCY`                                 | Overrides `queue.concurrency`.                                 |
| `JETQUEUE_MAX_QUEUED_JOBS`                             | Overrides `queue.maxQueuedJobs`.                               |
| `JETQUEUE_AUTO_START`                                  | Overrides `queue.autoStart` (`true`/`false`).                  |
| `JETQUEUE_DEFAULT_PRIORITY`                            | Overrides `queue.defaultJobOptions.priority`.                  |
| `JETQUEUE_DEFAULT_TIMEOUT`                             | Overrides `queue.defaultJobOptions.timeout`.                   |
| `JETQUEUE_DEFAULT_MAX_ATTEMPTS`                        | Overrides `queue.defaultJobOptions.maxAttempts`.               |
| `JETQUEUE_RETRY_STRATEGY`                              | Overrides `retryOptions.strategy`.                             |
| `JETQUEUE_RETRY_DELAY`                                 | Overrides `retryOptions.delay`.                                |
| `JETQUEUE_RETRY_MAX_DELAY`                             | Overrides `retryOptions.maxDelay`.                             |
| `JETQUEUE_STORAGE_TYPE`                                | Sets `storage.type` (`postgres`, `redis`, `sqlite`, `memory`). |
| `DATABASE_URL` / `JETQUEUE_POSTGRES_CONNECTION_STRING` | Overrides `storage.postgres.connectionString`.                 |
| `JETQUEUE_POSTGRES_HOST`                               | Overrides `postgres.host`.                                     |
| `JETQUEUE_POSTGRES_PORT`                               | Overrides `postgres.port`.                                     |
| `JETQUEUE_POSTGRES_DATABASE`                           | Overrides `postgres.database`.                                 |
| `JETQUEUE_POSTGRES_USERNAME`                           | Overrides `postgres.username`.                                 |
| `JETQUEUE_POSTGRES_PASSWORD`                           | Overrides `postgres.password`.                                 |
| `JETQUEUE_POSTGRES_SCHEMA`                             | Overrides `postgres.schema`.                                   |
| `REDIS_URL` / `JETQUEUE_REDIS_CONNECTION_STRING`       | Overrides `redis.connectionString`.                            |
| `JETQUEUE_REDIS_HOST`                                  | Overrides `redis.host`.                                        |
| `JETQUEUE_REDIS_PORT`                                  | Overrides `redis.port`.                                        |
| `JETQUEUE_REDIS_PASSWORD`                              | Overrides `redis.password`.                                    |
| `JETQUEUE_REDIS_DB`                                    | Overrides `redis.db`.                                          |
| `JETQUEUE_REDIS_PREFIX`                                | Overrides `redis.prefix`.                                      |
| `JETQUEUE_REDIS_MAX_RETRIES`                           | Overrides `redis.maxRetries`.                                  |
| `JETQUEUE_SQLITE_FILENAME`                             | Overrides `sqlite.filename`.                                   |
| `JETQUEUE_SQLITE_WAL`                                  | Overrides `sqlite.wal`.                                        |
| `JETQUEUE_SQLITE_BUSY_TIMEOUT`                         | Overrides `sqlite.busyTimeout`.                                |

**Priority order:** Environment variables take precedence over the configuration file, which in turn overrides defaults.

---

## Validation & Error Handling

Configuration is validated using Zod. On failure, the loader prints a detailed error list:

```bash
❌ Configuration validation failed:
  - storage.postgres.host: Required when type is "postgres"
  - queue.concurrency: Must be a positive integer
  - dashboard.auth.password: String must contain at least 8 character(s)
```

The loader throws a `ZodError` which you can catch and handle as needed.

## Custom Runtime Validation (Optional)

Although not part of the core schema, you can perform additional validation after loading:

```ts
const config = await loadConfig();

if (
  config.storage.type === "postgres" &&
  !config.storage.postgres?.connectionString
) {
  throw new Error("PostgreSQL connection string is required in production");
}
```

## System Architecture & Testing

The configuration system is built on a few key components:

- **Zod schemas** – Define the shape and constraints of every configuration section.
- **Registry** – A global map that stores plugin schemas; `getCombinedSchema()` merges them with the base schema.
- **ConfigLoader** – A singleton that orchestrates file discovery, environment parsing, and validation.
- **Deep merge utility** – Recursively merges configuration objects from multiple sources.

- The system is **thoroughly tested** with four test suites covering:

- **Schema validation** – Ensures all constraints, defaults, and discriminated unions work as expected.
- **File loading** – Mocks cosmiconfig to test successful loads and missing files.
- **Environment variable parsing** – Verifies every possible environment override for queue, job, retry, and storage options.
- **Plugin registration** – Confirms that plugin schemas are correctly merged, validated, and accessible via getPluginConfig.

This gives high confidence that the configuration system behaves correctly in production.

## Summary

- **Single, unified config** – All settings in one file, but each package owns its own shape.
- **Type‑safe** – Zod + TypeScript give you autocomplete and compile‑time checks.
- **Flexible sources** – File, environment variables, and defaults.
- **Plugin‑friendly** – Register schemas and they become part of the validated config.
- **Developer‑friendly** – Clear error messages and easy debugging.
- **Battle‑tested** – Comprehensive tests ensure reliability and help prevent regressions
