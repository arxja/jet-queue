import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { queueClient } from "@job-queue-system/client";
import type { StatsResponse, JobResponse } from "@job-queue-system/client";

interface DashboardProps {
  serverUrl: string;
}

export function Dashboard({ serverUrl }: DashboardProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobResponse[]>([]);
  const [connected, setConnected] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [client] = useState(() => new queueClient({ baseUrl: serverUrl }));

  // Connect to server and set up polling + real-time events
  useEffect(() => {
    // Connect WebSocket for real-time updates
    client.connect();

    // Listen for all events to update recent jobs
    client.onEvent("job:completed", (data: any) => {
      if (data.job) {
        setRecentJobs((prev) => [data.job, ...prev].slice(0, 10));
      }
    });

    client.onEvent("job:failed", (data: any) => {
      if (data.job) {
        setRecentJobs((prev) => [data.job, ...prev].slice(0, 10));
      }
    });

    client.onEvent("job:started", (data: any) => {
      if (data.job) {
        setRecentJobs((prev) => [data.job, ...prev].slice(0, 10));
      }
    });

    client.onEvent("connected", (data: any) => {
      setConnected(true);
    });

    // Poll for stats every second
    const pollInterval = setInterval(async () => {
      try {
        const newStats = await client.getStats();
        setStats(newStats);
        setUptime(newStats.uptime);
        setConnected(true);
      } catch {
        setConnected(false);
      }
    }, 1000);

    // Initial fetch
    client
      .getStats()
      .then(setStats)
      .catch(() => {});

    return () => {
      clearInterval(pollInterval);
      client.disconnect();
    };
  }, []);

  // Keyboard controls
  useInput((input, key) => {
    if (input === "q") {
      process.exit(0);
    }
    if (input === "r") {
      // Refresh manually
      client
        .getStats()
        .then(setStats)
        .catch(() => {});
    }
  });

  if (!stats) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">⏳ Connecting to TaskForge server...</Text>
        <Text dimColor>{serverUrl}</Text>
      </Box>
    );
  }

  const statusColor = connected ? "green" : "red";
  const statusIcon = connected ? "🟢" : "🔴";

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          ⚡ TaskForge Queue Dashboard
        </Text>
        <Box>
          <Text color={statusColor}>{statusIcon}</Text>
          <Text> Server: </Text>
          <Text color="blue">{serverUrl}</Text>
          <Text> | Uptime: </Text>
          <Text color="yellow">{formatUptime(uptime)}</Text>
        </Box>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        padding={1}
        marginBottom={1}
      >
        {/* Stats Cards Row */}
        <Box justifyContent="space-between" marginBottom={1}>
          <StatCard label="PENDING" value={stats.pending} color="yellow" />
          <StatCard label="RUNNING" value={stats.running} color="blue" />
          <StatCard label="COMPLETED" value={stats.completed} color="green" />
          <StatCard label="FAILED" value={stats.failed} color="red" />
        </Box>

        {/* Throughput Bar */}
        <Box marginBottom={1}>
          <Text>Throughput: </Text>
          <Text color="magenta">
            {stats.throughput ? stats.throughput.toFixed(1) : "0.0"} jobs/min
          </Text>
          <Text> | Workers: </Text>
          <Text color="blue">
            {stats.running}/{stats.pending + stats.running || "∞"}
          </Text>
          <Text> | Delayed: </Text>
          <Text color="gray">{stats.delayed}</Text>
        </Box>
      </Box>

      {/* Recent Jobs */}
      <Box flexDirection="column">
        <Text bold underline>
          Recent Jobs
        </Text>
        {recentJobs.length === 0 && (
          <Text dimColor> No jobs processed yet</Text>
        )}
        {recentJobs.map((job, i) => (
          <JobRow key={job.id + i} job={job} />
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press 'q' to quit | 'r' to refresh</Text>
      </Box>
    </Box>
  );
}

// Sub components

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box flexDirection="column" alignItems="center" width="25%">
      <Text bold color={color}>
        {value}
      </Text>
      <Text dimColor>{label}</Text>
    </Box>
  );
}

function JobRow({ job }: { job: JobResponse }) {
  // Pick icon based on status
  const icon =
    {
      pending: "⏳",
      running: "🔄",
      completed: "✅",
      failed: "❌",
      delayed: "⏰",
      cancelled: "🚫",
    }[job.status] || "❓";

  const color =
    {
      pending: "yellow",
      running: "blue",
      completed: "green",
      failed: "red",
      delayed: "gray",
      cancelled: "gray",
    }[job.status] || "white";

  return (
    <Box>
      <Text>{icon} </Text>
      <Text dimColor>{job.id.slice(0, 12)}</Text>
      <Text> </Text>
      <Text color={color}>{job.name}</Text>
      <Text dimColor> {job.status}</Text>
      {job.progress > 0 && job.progress < 100 && (
        <Text color="blue"> {job.progress}%</Text>
      )}
    </Box>
  );
}

// Helpers

function formatUptime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return "0s";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
