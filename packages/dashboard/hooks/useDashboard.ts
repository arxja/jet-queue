"use client";

import { JetQueueClient } from "@jet-queue/client";
import { useState, useEffect, useCallback } from "react";
import { DashboardStats, JobWithDuration } from "@/types/type";

const SERVER_URL =
  process.env.NEXT_PUBLIC_JETQUEUE_URL || "http://localhost:3001";

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobWithDuration[]>([]);
  const [connected, setConnected] = useState(false);
  const [client, setClient] = useState<JetQueueClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = new JetQueueClient({ baseUrl: SERVER_URL });
    setClient(c);

    return () => {
      c.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!client) return;
    client.connect();

    const handleJobEvent = (data: any) => {
      if (data.job) {
        const job: JobWithDuration = {
          id: data.job.id,
          name: data.job.name,
          status: data.job.status,
          priority: data.job.priority,
          progress: data.job.progress || 0,
          error: data.job.error,
          duration: data.duration,
          createdAt: data.job.createdAt || new Date().toISOString(),
        };
        setRecentJobs((prev) => [job, ...prev].slice(0, 20));
      }
    };

    client.onEvent("job:completed", handleJobEvent);
    client.onEvent("job:failed", handleJobEvent);
    client.onEvent("job:started", handleJobEvent);
    client.onEvent("job:progress", handleJobEvent);
    client.onEvent("connected", () => {
      setConnected(true);
      setError(null);
    });

    const poll = setInterval(async () => {
      try {
        const stats = await client.getStats();
        setStats(stats as DashboardStats);
        setConnected(true);
        setError(null);
      } catch (err) {
        setConnected(false);
        setError("Failed to connect to server");
      }
    }, 2000);

    client
      .getStats()
      .then((s) => {
        setStats(s as DashboardStats);
        setConnected(true);
      })
      .catch(() => {
        setConnected(false);
        setError("Failed to connect to server");
      });

    return () => {
      clearInterval(poll);
      client.disconnect();
    };
  }, [client]);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      const s = await client.getStats();
      setStats(s as DashboardStats);
    } catch {}
  }, [client]);

  return { stats, recentJobs, connected, error, refresh };
}
