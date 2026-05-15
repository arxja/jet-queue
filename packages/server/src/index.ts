import { createApp } from "./app";
import { initQueue, shutdownQueue } from "./queue-manager";
import {
  cleanupWebSocket,
  handleWebSocketMessage,
  setupQueueEvents,
  setupWebSocket,
} from "./websocket";

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
  fetch(req, server) {
    const url = new URL(req.url);

    // Check if this is a WebSocket upgrade request
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return; // Successfully upgraded to WebSocket
      }
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // All other requests go to Hono
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
