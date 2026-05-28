"use client";

import { useRef, useState, useCallback } from "react";
import { JetQueue } from "@jet-queue/core";

export type LogEntry = {
  id: string;
  timestamp: number;
  type: "queued" | "started" | "completed" | "failed" | "retry";
  message: string;
  jobName: string;
  duration?: number;
  error?: string;
};

export function useQueue() {
  const queueRef = useRef<JetQueue | null>(null);

  // Logs are state so they trigger re-renders
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });

  // Create queue once
  if (!queueRef.current) {
    queueRef.current = new JetQueue({
      concurrency: 3,
      autoStart: true,
    });

    // Listen to ALL events and create log entries
    const q = queueRef.current;

    q.on("job:added", ({ job }) => {
      addLog({
        id: job.id,
        type: "queued",
        message: `Queued: ${job.name}`,
        jobName: job.name,
        timestamp: Date.now(),
      });
      updateStats();
    });

    q.on("job:started", ({ job }) => {
      addLog({
        id: job.id,
        type: "started",
        message: `🔄 Processing: ${job.name}`,
        jobName: job.name,
        timestamp: Date.now(),
      });
      updateStats();
    });

    q.on("job:completed", ({ job, duration }) => {
      addLog({
        id: job.id,
        type: "completed",
        message: `✅ Completed: ${job.name}`,
        jobName: job.name,
        duration,
        timestamp: Date.now(),
      });
      updateStats();
    });

    q.on("job:failed", ({ job, error }) => {
      addLog({
        id: job.id,
        type: "failed",
        message: `❌ Failed: ${job.name} - ${error.message}`,
        jobName: job.name,
        error: error.message,
        timestamp: Date.now(),
      });
      updateStats();
    });

    q.on("job:retry", ({ job, attempt }) => {
      addLog({
        id: job.id,
        type: "retry",
        message: `🔄 Retrying: ${job.name} (attempt ${attempt})`,
        jobName: job.name,
        timestamp: Date.now(),
      });
      updateStats();
    });
  }

  // Helper to add log (newest first, max 50)
  function addLog(entry: LogEntry) {
    setLogs((prev) => [entry, ...prev].slice(0, 50));
  }

  function updateStats() {
    if (queueRef.current) {
      setStats(queueRef.current.getState());
    }
  }

  // Add a job to the queue
  const addJob = useCallback((name: string, task: () => Promise<any>) => {
    if (queueRef.current) {
      queueRef.current.add(task, { name });
    }
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    queue: queueRef.current,
    logs,
    stats,
    addJob,
    clearLogs,
  };
}
