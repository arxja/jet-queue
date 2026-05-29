import { JetQueueClient } from "@jet-queue/client";

const SERVER_URL =
  process.env.NEXT_PUBLIC_JETQUEUE_URL || "http://localhost:3001";

let clientInstance: JetQueueClient | null = null;

export function getClient(): JetQueueClient {
  if (!clientInstance) {
    clientInstance = new JetQueueClient({ baseUrl: SERVER_URL });
  }
  return clientInstance;
}

export async function fetchStats() {
  try {
    const client = getClient();
    return await client.getStats();
  } catch {
    return null;
  }
}

export async function fetchHealth() {
  try {
    const client = getClient();
    return await client.health();
  } catch {
    return null;
  }
}
