# @jet-queue/client SDK

## Installation
```bash
npm install @jet-queue/client
```

## Usage

```ts
import { JetQueueClient } from '@jet-queue/client';
const client = new JetQueueClient({ baseUrl: 'http://localhost:3001' });

// Add a job
const job = await client.addJob('send-email', { data: { to: 'user@test.com' } });

// Check status
const status = await client.getJob(job.id);

// Real‑time events
client.connect();
client.onJobCompleted(job.id, (job) => console.log('Done!', job.result));
```

## Methods
`addJob(handler, options?)`, `getJob(id)`, `getJobProgress(id)`, `cancelJob(id)`, `retryJob(id)`,` getStats()`, `health()`, `connect()`, `disconnect()`,` onJobCompleted(id, cb)`, `onJobFailed(id, cb)`, `onJobProgress(id, cb)`, `onEvent(type, cb)`.