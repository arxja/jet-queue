"use client";

import { JobWithDuration } from "@/types/type";

const statusIcons: Record<string, string> = {
  pending: "⏳",
  running: "🔄",
  completed: "✅",
  failed: "❌",
  delayed: "⏰",
  cancelled: "🚫",
};

const statusColors: Record<string, string> = {
  pending: "text-yellow-600",
  running: "text-blue-600",
  completed: "text-green-600",
  failed: "text-red-600",
  delayed: "text-gray-600",
  cancelled: "text-gray-400",
};

const JobRow = ({ job }: { job: JobWithDuration }) => {
  const icon = statusIcons[job.status] || "❓";
  const color = statusColors[job.status] || "text-gray-600";

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm">{icon}</span>
      <span className="font-mono text-xs text-gray-400 w-16 truncate">
        {job.id.slice(0, 10)}
      </span>
      <span className={`flex-1 text-sm ${color}`}>
        {job.name || job.id.slice(0, 8)}
      </span>
      {job.status === "running" && job.progress && job.progress > 0 && (
        <div className="w-24 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}
      <span className="text-xs text-gray-400 w-20 text-right">
        {job.status}
      </span>
      {job.duration && (
        <span className="text-xs text-gray-400 w-16 text-right">
          {formatDuration(job.duration)}
        </span>
      )}
    </div>
  );
};

export default JobRow;
