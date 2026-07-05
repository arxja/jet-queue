# JetQueue - Configuration System

JetQueue's configuration system is designed to be modular, type-safe, and developer-friendly. Each package registers its own configuration schema, enabling intelligent autocomplete and validation.

## Overview

JetQueue uses a **plugin-based configuration system** where:

- Each package owns and validates its own configuration section
- Configuration is loaded once and shared across all packages
- IDE autocomplete works for installed packages only
- TypeScript types are generated automatically

## Configuration File

Create a `jetqueue.config.ts` or `jetqueue.config.js` file in your project root:

```typescript
import { defineConfig } from "@jetqueue/core";

export default defineConfig({
  // Core settings (always available)
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

  // Storage (available when @jetqueue/storage is installed)
  storage: {
    type: "postgres",
    postgres: {
      host: "localhost",
      port: 5432,
      database: "jetqueue",
      username: "postgres",
      password: "postgres",
    },
  },
  // more coming soon ...
});
```

## Available Configuration Sections

<!-- todo: fill this section in this file or in getting started-->

## Configuration Priority

Configuration is loaded with the following priority (highest to lowest):

1. Environment variables (when using interpolation)
2. JetQueue config file (jetqueue.config.js / jetqueue.config.ts)
3. Default values

## Configuration Validation

Validation runs automatically when the configuration is loaded. Errors are reported with clear messages:

```bash
❌ Config validation failed:
  - storage.postgres.host: Required when type is "postgres"
  - dashboard.auth.password: Password must be at least 8 characters
  - queue.concurrency: Must be a positive integer
```

### Custom Validation

Add custom validation using validate option:

```ts
export default defineConfig({
  queue: {
    concurrency: 10,
    // ... other options
  },
  // Custom validation
  validate: (config) => {
    if (config.storage.type === "postgres" && !config.storage.postgres) {
      throw new Error("Postgres config required");
    }
    return config;
  },
});
```
