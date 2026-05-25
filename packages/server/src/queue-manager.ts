import { JetQueue, SQLiteStorage } from "@jet-queue/core";
import type { Job } from "@jet-queue/core";

let queue: JetQueue | null = null;

export function getQueue(): JetQueue {
  if (!queue) {
    throw new Error("Queue not initialized. Call initQueue() first.");
  }
  return queue;
}

export async function initQueue(
  options: {
    concurrency?: number;
    dbPath?: string;
    autoStart?: boolean;
  } = {},
): Promise<JetQueue> {
  const storage = options.dbPath
    ? new SQLiteStorage(options.dbPath)
    : undefined;

  queue = new JetQueue(
    {
      concurrency: options.concurrency || 5,
      autoStart: options.autoStart !== false,
    },
    storage,
  );

  queue.registerHandler("default", async (job: Job) => {
    console.log(`[Default Handler] Job ${job.id} executed`);
    return { handled: true };
  });

  console.log("[Queue] Initialized successfully");

  return queue;
}

export async function shutdownQueue(): Promise<void> {
  const q = getQueue();
  await q.shutdown();
  queue = null;
  console.log("[Queue] Shutdown complete");
}
