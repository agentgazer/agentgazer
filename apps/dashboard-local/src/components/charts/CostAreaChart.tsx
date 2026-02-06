import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CostSeriesEntry {
  timestamp: string;
  cost: number;
  tokens: number;
}

type Range = "1h" | "24h" | "7d" | "30d";

interface CostAreaChartProps {
  series: CostSeriesEntry[];
  range?: Range;
}

export default function CostAreaChart({ series, range = "24h" }: CostAreaChartProps) {
  if (series.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        No cost data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          tickFormatter={(v: string) => {
            const d = new Date(v);
            if (range === "1h") {
              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } else if (range === "24h") {
              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } else {
              return d.toLocaleDateString([], { month: "short", day: "numeric" });
            }
          }}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={{ stroke: "#374151" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={{ stroke: "#374151" }}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          width={65}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 6,
            color: "#e5e7eb",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            name === "cost" ? `$${value.toFixed(4)}` : value.toLocaleString(),
            name === "cost" ? "Cost" : "Tokens",
          ]}
          labelFormatter={(label: string) => {
            const d = new Date(label);
            if (range === "1h" || range === "24h") {
              return d.toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            }
            return d.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
          }}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="#3b82f6"
          fill="url(#costGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
