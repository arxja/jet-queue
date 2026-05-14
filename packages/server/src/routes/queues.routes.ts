import { Hono } from "hono";
import { QueuesController } from "../controllers/queues.controller";

const queuesController = new QueuesController();
export const queues = new Hono();

// GET /api/queues - List all queues
queues.get("/", (c) => queuesController.listQueues(c));
// GET /api/queues/stats - Get queue statistics
queues.get("/stats", (c) => queuesController.getStats(c));
