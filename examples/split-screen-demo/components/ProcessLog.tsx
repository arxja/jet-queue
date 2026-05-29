"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/hooks/useQueue";

interface ProcessLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

const typeStyles: Record<string, { icon: string; color: string }> = {
  queued: { icon: "⏳", color: "text-yellow-600" },
  started: { icon: "🔄", color: "text-blue-600" },
  completed: { icon: "✅", color: "text-green-600" },
  failed: { icon: "❌", color: "text-red-600" },
  retry: { icon: "🔄", color: "text-orange-600" },
};

const ProcessLog = ({ logs, onClear }: ProcessLogProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-black">
            ⚙️ Process Log
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Real-time
            </span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            What JetQueue is doing in the background
          </p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm">No jobs yet.</p>
            <p className="text-xs mt-1">
              Fill the form to see the queue in action!
            </p>
          </div>
        )}

        {logs.map((log, index) => {
          const style = typeStyles[log.type] || {
            icon: "•",
            color: "text-gray-600",
          };
          return (
            <div
              key={`${log.id}-${log.timestamp}-${index}`}
              className={`flex items-center gap-2 text-sm ${style.color} bg-gray-50 rounded-lg px-3 py-2`}
            >
              <span>{style.icon}</span>
              <span className="flex-1">{log.message}</span>
              {log.duration && (
                <span className="text-xs text-gray-400">{log.duration}ms</span>
              )}
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default ProcessLog;
