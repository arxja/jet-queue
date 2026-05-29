# @jet-queue/core API

## `new JetQueue(options?)`

| Option            | Type    | Default  | Description                  |
| ----------------- | ------- | -------- | ---------------------------- |
| concurrency       | number  | 5        | Max simultaneous jobs        |
| autoStart         | boolean | true     | Start processing immediately |
| maxQueuedJobs     | number  | Infinity | Max pending jobs             |
| defaultJobOptions | object  | {}       | Default options for all jobs |

## `queue.add(taskFn, options?)`

Returns job ID.

```ts
queue.add(
  async (job) => {
    /* work */
  },
  {
    name: "send-email",
    priority: "high", // low | normal | high | critical
    timeout: 30000,
    maxAttempts: 3,
    retryOptions: { strategy: "exponential", delay: 1000 },
    delay: 5000, // delay before first run
    tags: ["email"],
  },
);
```

## Events

```ts
queue.on("job:added", ({ job }) => {});
queue.on("job:completed", ({ job, result, duration }) => {});
queue.on("job:failed", ({ job, error, duration }) => {});
queue.on("job:progress", ({ job, progress }) => {});
queue.on("queue:drain", ({ stats }) => {});
```
## Storage

```ts
import { MemoryStorage, SQLiteStorage } from '@jet-queue/core';
new JetQueue({}, new MemoryStorage());                // volatile
new JetQueue({}, new SQLiteStorage('./queue.db'));    // persistent
```

