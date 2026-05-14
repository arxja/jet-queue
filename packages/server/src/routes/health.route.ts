import { Hono } from "hono";
import { getQueue } from "../queue-manager";

const health = new Hono();

health.get("/", (c) => {
  let queue;
  try {
    queue = getQueue();
  } catch {
    return c.json({ status: "degraded", error: "Queue not initialized" }, 503);
  }

  const stats = queue.getState();
  const uptime = process.uptime();

  return c.json({
    status: "healthy",
    uptime: Math.floor(uptime),
    queues: 1,
    workers: stats.running,
    version: "1.0.0",
  });
});

export { health };
