# @jet-queue/server API

The server package provides a ready‑to‑run Bun server and building blocks for custom servers.

## Quick Start (standalone)
```bash
bun run @jet-queue/server
# or programmatically:
import { initQueue, createApp } from '@jet-queue/server';
const queue = await initQueue({ concurrency: 3 });
queue.registerHandler('email', async (job) => { … });
const app = createApp();
Bun.serve({ fetch: app.fetch, port: 3001, websocket: { … } });
```

## REST Endpoints

| Method | Path | Description |
|---|---|---|
| **POST** | `/api/jobs` | Add a job |
| **GET** | `/api/jobs/:id` | Job details |
| **DELETE** | `/api/jobs/:id` | Cancel job |
| **POST** | `/api/jobs/:id/retry` | Retry failed job |
| **GET** | `/api/queues/stats` | Queue statistics |
| **GET** | `/api/health` | Health check |
| **WS** | `/ws` | Real-time events |