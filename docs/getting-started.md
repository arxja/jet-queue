# Getting Started with JetQueue

## Installation

```bash
npm install @jet-queue/core

# or 

pnpm add @jet-queue/core

# or 

yarn add @jet-queue/core
```

## Your First Queue

```ts
import { JetQueue } from "@jet-queue/core";

const queue = new JetQueue({ concurrency: 3 });

queue.add(
  async () => {
    console.log("Job done!");
  },
  { name: "my-first-job" },
);

queue.on("queue:drain", () => {
  console.log("All jobs finished");
});
```

## Using the Server (Bun)

```bash
npx @jet-queue/server --port 3001
```
> [!TIP]
> you can use whatever package manger you want, here is the npm example

Then connect with the client:

```bash
npm install @jet-queue/client
```

```ts
import { JetQueueClient } from "@jet-queue/client";
const client = new JetQueueClient({ baseUrl: "http://localhost:3001" });
await client.addJob("send-email", { data: { to: "user@test.com" } });
```

## Next Steps
- [Core API](./core.md)
- [Server API](./server.md)
- [Client SDK](./client.md)
- [Architecture](./architecture.md)