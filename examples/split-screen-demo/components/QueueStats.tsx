"use client";

interface QueueStatsProps {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

const QueueStats = ({
  pending,
  running,
  completed,
  failed,
}: QueueStatsProps) => {
  const statCards = [
    {
      label: "Pending",
      value: pending,
      color: "bg-yellow-100 border-yellow-300 text-yellow-700",
    },
    {
      label: "Running",
      value: running,
      color: "bg-blue-100 border-blue-300 text-blue-700",
    },
    {
      label: "Completed",
      value: completed,
      color: "bg-green-100 border-green-300 text-green-700",
    },
    {
      label: "Failed",
      value: failed,
      color: "bg-red-100 border-red-300 text-red-700",
    },
  ];
  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        📊 Queue Stats
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          Live
        </span>
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`text-center p-3 rounded-lg border ${stat.color}`}
          >
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs opacity-75">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueueStats;
