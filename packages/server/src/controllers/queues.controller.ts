import type { Context } from "hono";
import { getQueue } from "../queue-manager";

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
    const stats = queue.getState();

    return c.json(stats);
  }
}
