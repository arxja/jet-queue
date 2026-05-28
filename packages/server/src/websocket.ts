import type { ServerWebSocket } from "bun";
import { getQueue } from "./queue-manager";

const clients = new Set<ServerWebSocket>();

// Message handlers
const messageHandlers: Record<
  string,
  (ws: ServerWebSocket, data: any) => void
> = {
  ping: (ws, data) => {
    ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
  },

  get_stats: (ws, data) => {
    try {
      const queue = getQueue();
      ws.send(
        JSON.stringify({
          type: "stats",
          data: queue.getState(),
        }),
      );
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Queue not available",
        }),
      );
    }
  },

  get_job: (ws, data) => {
    if (!data.jobId) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "jobId is required",
        }),
      );
      return;
    }

    try {
      const queue = getQueue();
      const job = queue.getJob(data.jobId);
      if (!job) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Job not found",
          }),
        );
        return;
      }
      ws.send(
        JSON.stringify({
          type: "job",
          data: job,
        }),
      );
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Failed to get job",
        }),
      );
    }
  },

  subscribe: (ws, data) => {
    if (data.events && Array.isArray(data.events)) {
      (ws as any).subscriptions = new Set(data.events);
      ws.send(
        JSON.stringify({
          type: "subscribed",
          events: data.events,
        }),
      );
    }
  },

  unsubscribe: (ws, data) => {
    if (data.events && Array.isArray(data.events)) {
      const subs = (ws as any).subscriptions;
      if (subs) {
        data.events.forEach((event: string) => subs.delete(event));
        ws.send(
          JSON.stringify({
            type: "unsubscribed",
            events: data.events,
          }),
        );
      }
    }
  },
};

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
}

export function handleWebSocketMessage(
  ws: ServerWebSocket,
  message: string | Buffer,
): void {
  try {
    const text = typeof message === "string" ? message : message.toString();
    const data = JSON.parse(text);
    const { type } = data;

    if (!type) {
      throw new Error("Missing message type");
    }

    const handler = messageHandlers[type];
    if (handler) {
      handler(ws, data);
    } else {
      ws.send(
        JSON.stringify({
          type: "error",
          error: `Unknown message type: ${type}`,
        }),
      );
    }
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        error:
          error instanceof Error ? error.message : "Invalid message format",
      }),
    );
  }
}

export function broadcast(event: string, data: unknown): void {
  const message = JSON.stringify({ type: event, data, timestamp: Date.now() });

  clients.forEach((client) => {
    // Check if client wants this event (subscription filter)
    const subscriptions = (client as any).subscriptions;
    if (
      subscriptions &&
      subscriptions instanceof Set &&
      !subscriptions.has(event)
    ) {
      return; // Skip if not subscribed
    }

    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(message);
    }
  });
}

export function cleanupWebSocket(ws: ServerWebSocket): void {
  // Remove from clients set
  const deleted = clients.delete(ws);

  if (deleted) {
    // Clear any subscriptions
    if ((ws as any).subscriptions) {
      delete (ws as any).subscriptions;
    }

    // Clear connection timestamp
    if ((ws as any).connectedAt) {
      delete (ws as any).connectedAt;
    }

    console.log(`[WS] Client disconnected (total: ${clients.size})`);
  }
}

let eventsSetup = false;
export function setupQueueEvents(): void {
  if (eventsSetup) {
    console.log("[WS] Queue events already registered");
    return;
  }
  eventsSetup = true;
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
