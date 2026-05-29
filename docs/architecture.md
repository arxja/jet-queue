# JetQueue Architecture

## Packages

- `@jet-queue/core` – engine (events, retries, storage)
- `@jet-queue/server` – Bun server (REST + WebSocket)
- `@jet-queue/client` – SDK for any environment
- `@jet-queue/cli` – terminal dashboard
- `@jet-queue/dashboard` – web dashboard (Next.js)

## Data Flow

```text
App → client.addJob() → HTTP POST /api/jobs → server → queue.add() → process
App ← client.onJobCompleted() ← WebSocket ← server ← queue.emit('job:completed')
```
