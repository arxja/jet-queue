"use client";

interface ConnectionBadgeProps {
  connected: boolean;
  error?: string | null;
}

const ConnectionBadge = ({ connected, error }: ConnectionBadgeProps) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          connected ? "bg-green-500 animate-pulse" : "bg-red-500"
        }`}
      />
      <span
        className={`text-sm ${connected ? "text-green-600" : "text-red-600"}`}
      >
        {connected ? "Connected" : error || "Disconnected"}
      </span>
    </div>
  );
};

export default ConnectionBadge;
