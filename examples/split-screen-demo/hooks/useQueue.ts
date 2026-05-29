"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { JetQueueClient } from "@jet-queue/client";
import type { StatsResponse } from "@jet-queue/client";

export type LogEntry = {
  id: string;
  timestamp: number;
  type: "queued" | "started" | "completed" | "failed" | "retry" | "progress";
  message: string;
  jobName: string;
  duration?: number;
  error?: string;
  progress?: number;
};

const SERVER_URL =
  process.env.NEXT_PUBLIC_JETQUEUE_URL || "http://localhost:3001";

export function useQueue() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<JetQueueClient | null>(null);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const fetchStats = useCallback(async (client: JetQueueClient) => {
    try {
      const s: StatsResponse = await client.getStats();
      setStats({
        pending: s.pending,
        running: s.running,
        completed: s.completed,
        failed: s.failed,
      });
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    const client = new JetQueueClient({ baseUrl: SERVER_URL });
    clientRef.current = client;
    client.connect();

    client.onEvent("connected", () => setConnected(true));

    client.onEvent("job:added", (data: any) => {
      addLog({
        id: data.job?.id || crypto.randomUUID(),
        type: "queued",
        message: `⏳ ${data.job?.name || "unknown"}`,
        jobName: data.job?.name || "unknown",
        timestamp: Date.now(),
      });
      fetchStats(client);
    });

    client.onEvent("job:started", (data: any) => {
      addLog({
        id: data.job?.id || "",
        type: "started",
        message: `🔄 ${data.job?.name || ""}`,
        jobName: data.job?.name || "",
        timestamp: Date.now(),
      });
      fetchStats(client);
    });

    client.onEvent("job:completed", (data: any) => {
      addLog({
        id: data.job?.id || "",
        type: "completed",
        message: `✅ ${data.job?.name || ""}`,
        jobName: data.job?.name || "",
        duration: data.duration,
        timestamp: Date.now(),
      });
      fetchStats(client);
    });

    client.onEvent("job:failed", (data: any) => {
      addLog({
        id: data.job?.id || "",
        type: "failed",
        message: `❌ ${data.job?.name || ""}: ${data.job?.error || "Unknown error"}`,
        jobName: data.job?.name || "",
        error: data.job?.error,
        timestamp: Date.now(),
      });
      fetchStats(client);
    });

    client.onEvent("job:progress", (data: any) => {
      addLog({
        id: data.job?.id || "",
        type: "progress",
        message: `📊 ${data.job?.name || ""}: ${data.progress || 0}%`,
        jobName: data.job?.name || "",
        progress: data.progress,
        timestamp: Date.now(),
      });
    });

    client.onEvent("job:retry", (data: any) => {
      addLog({
        id: data.job?.id || "",
        type: "retry",
        message: `🔄 Retrying ${data.job?.name || ""}`,
        jobName: data.job?.name || "",
        timestamp: Date.now(),
      });
    });

    fetchStats(client);

    return () => {
      client.disconnect();
    };
  }, [addLog, fetchStats]);

  const addJob = useCallback(
    async (handler: string, data?: any) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        await client.addJob(handler, { data });
      } catch (err: any) {
        addLog({
          id: crypto.randomUUID(),
          type: "failed",
          message: `❌ Failed to add job: ${err.message}`,
          jobName: handler,
          error: err.message,
          timestamp: Date.now(),
        });
      }
    },
    [addLog],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, stats, connected, addJob, clearLogs };
}
