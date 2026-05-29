"use client";

import { useQueue } from "@/hooks/useQueue";
import UserPanel from "@/components/UserPanel";
import ProcessLog from "@/components/ProcessLog";
import QueueStats from "@/components/QueueStats";

export default function Home() {
  const { logs, stats, addJob, clearLogs } = useQueue();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚡</span>
          <h1 className="text-lg font-bold">JetQueue Demo</h1>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
            See the difference a job queue makes
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/arxja/jet-queue"
            target="_blank"
            className="text-gray-400 hover:text-white transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="w-1/2 border-r border-gray-300 bg-white">
          <UserPanel onJobQueued={() => {}} addJob={addJob} />
        </div>

        <div className="w-1/2 flex flex-col bg-white">
          <div className="flex-1">
            <ProcessLog logs={logs} onClear={clearLogs} />
          </div>
          <QueueStats
            pending={stats.pending}
            running={stats.running}
            completed={stats.completed}
            failed={stats.failed}
          />
        </div>
      </div>
    </div>
  );
}
