import type { ServerWebSocket } from "bun";
import { getQueue } from "./queue-manager";

const clients = new Set<ServerWebSocket>();

export function setupWebSocket(ws: ServerWebSocket): void {
  clients.add(ws);
  console.log(`[WS] Client connected (total: ${clients.size})`);

  // Send current state on connect
  try {
    const queue = getQueue();
    ws.send(
      JSON.stringify({
        type: "connected",
        stats: queue.getState(),
      }),
    );
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        error: "Queue not initialized",
      }),
    );
  }

  ws.close = () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (total: ${clients.size})`);
  };
}

export function broadcast(event: string, data: unknown): void {
  const message = JSON.stringify({ type: event, data, timestamp: Date.now() });

  clients.forEach((client) => {
    if (client.readyState === 1) {
      // 1 = OPEN
      client.send(message);
    }
  });
}

export function setupQueueEvents(): void {
  const queue = getQueue();

  // Forward all queue events to WebSocket clients
  queue.on("job:added", (payload: any) => broadcast("job:added", payload));
  queue.on("job:started", (payload: any) => broadcast("job:started", payload));
  queue.on("job:completed", (payload: any) =>
    broadcast("job:completed", payload),
  );
  queue.on("job:failed", (payload: any) => broadcast("job:failed", payload));
  queue.on("job:progress", (payload: any) =>
    broadcast("job:progress", payload),
  );
  queue.on("job:retry", (payload: any) => broadcast("job:retry", payload));
  queue.on("queue:drain", (payload: any) => broadcast("queue:drain", payload));
  queue.on("queue:paused", () => broadcast("queue:paused", {}));
  queue.on("queue:resumed", () => broadcast("queue:resumed", {}));

  console.log("[WS] Queue events registered");
}
