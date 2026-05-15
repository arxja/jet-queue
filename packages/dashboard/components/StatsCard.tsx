"use client";

interface StatsCardProps {
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "red" | "gray";
  icon: string;
}

const colorClasses = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  green: "bg-green-50 border-green-200 text-green-700",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
  red: "bg-red-50 border-red-200 text-red-700",
  gray: "bg-gray-50 border-gray-200 text-gray-700",
};

const StatsCard = ({ label, value, color, icon }: StatsCardProps) => {
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-80">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="mt-2">
        <span className="text-3xl font-bold">{value.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default StatsCard;
