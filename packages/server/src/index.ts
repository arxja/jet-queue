import { createApp } from "./app";
import { initQueue, shutdownQueue } from "./queue-manager";
import { handleWebSocketMessage, setupQueueEvents, setupWebSocket } from "./websocket";

const PORT = parseInt(process.env.PORT || "3001");
const DB_PATH = process.env.DB_PATH || undefined;

console.log("🚀 Starting TaskForge Server...");
console.log(`   Port: ${PORT}`);
console.log(`   DB: ${DB_PATH || "in-memory"}`);

// Initialize queue
await initQueue({
  dbPath: DB_PATH,
  concurrency: parseInt(process.env.CONCURRENCY || "5"),
});

// Setup WebSocket event forwarding
setupQueueEvents();

// Create Hono app
const app = createApp();

// Start server with WebSocket support
const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
  websocket: {
    open(ws) {
      setupWebSocket(ws);
    },
    message(ws, message) {
      handleWebSocketMessage(ws, message);
    },
    close(ws) {
      console.log(`[WS] Client disconnected`);
    },
  },
});

console.log(`✅ TaskForge Server running at http://localhost:${PORT}`);
console.log(`   REST API: http://localhost:${PORT}/api`);
console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
console.log(`   Health: http://localhost:${PORT}/api/health`);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await shutdownQueue();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down...");
  await shutdownQueue();
  server.stop();
  process.exit(0);
});
