import type { Context } from "hono";
import { getQueue } from "../queue-manager";

let lastCompletedCount = 0;
let lastThroughputTime = Date.now();
let serverStartTime = Date.now();

function calculateThroughput(): number {
  const queue = getQueue();
  const currentCompleted = queue.getState().completed;
  const now = Date.now();
  const minutesPassed = (now - lastThroughputTime) / 60000;

  let throughput = 0;
  if (minutesPassed > 0 && lastCompletedCount > 0) {
    throughput = (currentCompleted - lastCompletedCount) / minutesPassed;
  }

  lastCompletedCount = currentCompleted;
  lastThroughputTime = now;
  return Math.max(0, Math.round(throughput * 10) / 10);
}

export class QueuesController {
  async listQueues(c: Context) {
    const queue = getQueue();
    const state = queue.getState();

    return c.json({
      queues: [
        {
          name: "default",
          stats: state,
        },
      ],
    });
  }

  async getStats(c: Context) {
    const queue = getQueue();
    const state = queue.getState();

    const enhancedStats = {
      ...state,
      throughput: calculateThroughput(),
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    };

    return c.json(enhancedStats);
  }
}
