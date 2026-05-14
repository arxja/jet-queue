import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jobs } from "./routes/jobs.routes";
import { queues } from "./routes/queues.routes";
import { health } from "./routes/health.route";

export function createApp(): Hono {
  const app = new Hono();

  // Middleware
  app.use(
    "*",
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [
        "http://localhost:3000",
      ],
      credentials: true,
    }),
  );
  app.use("*", logger());

  // Routes
  app.route("/api/jobs", jobs);
  app.route("/api/queues", queues);
  app.route("/api/health", health);

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
  });

  // Global error handler
  app.onError((error, c) => {
    console.error("[Server Error]", error);
    return c.json(
      {
        error: error.message || "Internal server error",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  });

  return app;
}
