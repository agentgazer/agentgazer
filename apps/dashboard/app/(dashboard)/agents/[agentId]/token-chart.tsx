"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type TimeRange = "1h" | "24h" | "7d" | "30d" | "custom";

interface TokenChartProps {
  agentId: string;
  range: TimeRange;
  customFrom?: string;
  customTo?: string;
  refreshKey?: number;
}

interface Bucket {
  label: string;
  tokensIn: number;
  tokensOut: number;
}

function rangeToISO(range: TimeRange, customFrom?: string): string {
  if (range === "custom" && customFrom) {
    return new Date(customFrom).toISOString();
  }
  const now = new Date();
  switch (range) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
    default:
      return new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
  }
}

function groupByHour(range: TimeRange): boolean {
  return range === "1h" || range === "24h";
}

function bucketKey(timestamp: string, byHour: boolean): string {
  const d = new Date(timestamp);
  if (byHour) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bucketLabel(key: string, byHour: boolean): string {
  if (byHour) {
    // "2024-01-15 14:00" -> "14:00"
    return key.split(" ")[1] ?? key;
  }
  // "2024-01-15" -> "Jan 15"
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TokenChart({ agentId, range, customFrom, customTo, refreshKey }: TokenChartProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const since = rangeToISO(range, customFrom);

      let query = supabase
        .from("agent_events")
        .select("timestamp, tokens_in, tokens_out")
        .eq("agent_id", agentId)
        .gte("timestamp", since)
        .order("timestamp", { ascending: true });

      if (range === "custom" && customTo) {
        query = query.lte("timestamp", new Date(customTo).toISOString());
      }

      const { data: events, error } = await query;

      if (cancelled) return;

      if (error || !events) {
        setBuckets([]);
        setLoading(false);
        return;
      }

      const byHour = groupByHour(range);
      const map = new Map<string, { tokensIn: number; tokensOut: number }>();

      for (const event of events) {
        const key = bucketKey(event.timestamp, byHour);
        const existing = map.get(key) ?? { tokensIn: 0, tokensOut: 0 };
        existing.tokensIn += event.tokens_in ?? 0;
        existing.tokensOut += event.tokens_out ?? 0;
        map.set(key, existing);
      }

      const sorted = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => ({
          label: bucketLabel(key, byHour),
          tokensIn: val.tokensIn,
          tokensOut: val.tokensOut,
        }));

      setBuckets(sorted);
      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [agentId, range, customFrom, customTo, refreshKey]);

  if (loading) {
    return (
      <div className="h-72 animate-pulse rounded-lg border border-gray-700 bg-gray-800" />
    );
  }

  const maxTokens = Math.max(
    ...buckets.map((b) => b.tokensIn + b.tokensOut),
    1
  );

  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const barCount = buckets.length || 1;
  const barWidth = Math.max(
    4,
    Math.min(40, (innerWidth - barCount * 2) / barCount)
  );
  const gap = Math.max(1, (innerWidth - barCount * barWidth) / (barCount + 1));

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <h3 className="mb-4 text-sm font-medium text-gray-300">
        Token Usage Over Time
      </h3>

      {buckets.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No token data for this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Bars */}
            {buckets.map((bucket, i) => {
              const x = padding.left + gap + i * (barWidth + gap);
              const totalHeight =
                ((bucket.tokensIn + bucket.tokensOut) / maxTokens) *
                innerHeight;
              const inHeight =
                (bucket.tokensIn / maxTokens) * innerHeight;
              const outHeight = totalHeight - inHeight;
              const y = padding.top + innerHeight - totalHeight;

              return (
                <g key={i}>
                  {/* Output tokens (top) */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(0, outHeight)}
                    fill="#f59e0b"
                    rx={1}
                  />
                  {/* Input tokens (bottom) */}
                  <rect
                    x={x}
                    y={y + outHeight}
                    width={barWidth}
                    height={Math.max(0, inHeight)}
                    fill="#3b82f6"
                    rx={1}
                  />
                  {/* X-axis label */}
                  {(buckets.length <= 12 ||
                    i % Math.ceil(buckets.length / 12) === 0) && (
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight - 4}
                      textAnchor="middle"
                      className="fill-gray-500"
                      fontSize={9}
                    >
                      {bucket.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* X axis line */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={chartWidth - padding.right}
              y2={padding.top + innerHeight}
              stroke="#374151"
              strokeWidth={1}
            />
          </svg>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
              Input Tokens
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
              Output Tokens
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
