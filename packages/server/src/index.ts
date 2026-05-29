// Re-export building blocks for custom servers
export { createApp } from "./app";
export { initQueue, shutdownQueue, getQueue } from "./queue-manager";
export {
  setupQueueEvents,
  setupWebSocket,
  handleWebSocketMessage,
  cleanupWebSocket,
} from "./websocket";

if (import.meta.main) {
  const { createApp } = await import("./app");
  const { initQueue, shutdownQueue } = await import("./queue-manager");
  const {
    setupQueueEvents,
    setupWebSocket,
    handleWebSocketMessage,
    cleanupWebSocket,
  } = await import("./websocket");

  const PORT = parseInt(process.env.PORT || "3001");
  const DB_PATH = process.env.DB_PATH || undefined;

  console.log("🚀 Starting JetQueue Server...");
  console.log(`   Port: ${PORT}`);
  console.log(`   DB: ${DB_PATH || "in-memory"}`);

  await initQueue({
    dbPath: DB_PATH,
    concurrency: parseInt(process.env.CONCURRENCY || "5"),
  });

  setupQueueEvents();

  const app = createApp();

  const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (upgraded) return;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return app.fetch(req);
    },
    websocket: {
      open(ws) {
        setupWebSocket(ws);
      },
      message(ws, message) {
        handleWebSocketMessage(ws, message);
      },
      close(ws) {
        cleanupWebSocket(ws);
        console.log("[WS] Client disconnected");
      },
    },
  });

  console.log(`✅ JetQueue Server running at http://localhost:${PORT}`);

  const shutdown = async () => {
    await shutdownQueue();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
