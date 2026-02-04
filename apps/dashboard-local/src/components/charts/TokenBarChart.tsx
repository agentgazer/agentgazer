import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatNumber } from "../../lib/format";

interface TokenSeriesEntry {
  timestamp: string;
  tokens_in: number | null;
  tokens_out: number | null;
}

interface TokenBarChartProps {
  series: TokenSeriesEntry[];
}

function formatXAxis(timestamp: string, dataLength: number): string {
  const date = new Date(timestamp);
  if (dataLength <= 10) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function TokenBarChart({ series }: TokenBarChartProps) {
  const data = series.slice(-50).map((d) => ({
    timestamp: d.timestamp,
    tokens_in: d.tokens_in ?? 0,
    tokens_out: d.tokens_out ?? 0,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No token data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="timestamp"
          tickFormatter={(v: string) => formatXAxis(v, data.length)}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={{ stroke: "#374151" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={{ stroke: "#374151" }}
          tickFormatter={(v: number) => formatNumber(v)}
          width={60}
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
            formatNumber(value),
            name === "tokens_in" ? "Tokens In" : "Tokens Out",
          ]}
          labelFormatter={(label: string) => {
            const d = new Date(label);
            return d.toLocaleString();
          }}
        />
        <Legend
          formatter={(value: string) => (value === "tokens_in" ? "Tokens In" : "Tokens Out")}
          wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
        />
        <Bar dataKey="tokens_in" fill="#3b82f6" radius={[2, 2, 0, 0]} opacity={0.85} />
        <Bar dataKey="tokens_out" fill="#8b5cf6" radius={[2, 2, 0, 0]} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
