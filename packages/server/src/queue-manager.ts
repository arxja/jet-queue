import { TaskQueue, SQLiteStorage } from "@job-queue-system/core";
import type { Job } from "@job-queue-system/core";

let queue: TaskQueue | null = null;

export function getQueue(): TaskQueue {
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
): Promise<TaskQueue> {
  const storage = options.dbPath
    ? new SQLiteStorage(options.dbPath)
    : undefined;

  queue = new TaskQueue(
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
