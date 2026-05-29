"use client";

import ConnectionBadge from "@/components/ConnectionBadge";
import JobRow from "@/components/JobRow";
import StatsCard from "@/components/StatsCard";
import { useDashboard } from "@/hooks/useDashboard";
import { JobWithDuration } from "@/types/type";

export default function Home() {
  const { stats, recentJobs, connected, error, refresh } = useDashboard();

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚡ JetQueue</h1>
            <p className="text-sm text-gray-500">Job Queue Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionBadge connected={connected} error={error} />
            <button
              onClick={refresh}
              className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 border-black text-black"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {!stats ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-500">
                {error || "Connecting to JetQueue server..."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard
                label="PENDING"
                value={stats.pending}
                color="yellow"
                icon="⏳"
              />
              <StatsCard
                label="RUNNING"
                value={stats.running}
                color="blue"
                icon="🔄"
              />
              <StatsCard
                label="COMPLETED"
                value={stats.completed}
                color="green"
                icon="✅"
              />
              <StatsCard
                label="FAILED"
                value={stats.failed}
                color="red"
                icon="❌"
              />
            </div>

            {/* Stats Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Throughput: </span>
                  <span className="font-semibold text-purple-600">
                    {(stats.throughput ?? 0).toFixed(1)} jobs/min
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Workers: </span>
                  <span className="font-semibold">{stats.running} active</span>
                </div>
                <div>
                  <span className="text-gray-500">Delayed: </span>
                  <span className="font-semibold">{stats.delayed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total: </span>
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Uptime: </span>
                  <span className="font-semibold">
                    {formatUptime(stats.uptime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Jobs */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  Recent Jobs
                  {recentJobs.length > 0 && (
                    <span className="text-gray-400 font-normal ml-2">
                      ({recentJobs.length})
                    </span>
                  )}
                </h2>
              </div>
              <div className="px-4 py-2">
                {recentJobs.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">
                    No jobs processed yet. Add jobs via the SDK or API.
                  </p>
                ) : (
                  recentJobs.map((job: any, i: number) => (
                    <JobRow key={`${job.id}-${i}`} job={job} />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
