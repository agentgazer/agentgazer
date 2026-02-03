import { useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

interface StatsResponse {
  total_requests: number;
  total_errors: number;
  error_rate: number;
  total_cost: number;
  total_tokens: number;
  p50_latency: number | null;
  p99_latency: number | null;
  cost_by_model: Array<{
    model: string;
    provider: string;
    cost: number;
    count: number;
  }>;
  token_series: Array<{
    timestamp: string;
    tokens_in: number | null;
    tokens_out: number | null;
  }>;
}

type Range = "1h" | "24h" | "7d" | "30d" | "custom";

const PRESET_RANGES: Range[] = ["1h", "24h", "7d", "30d"];

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatLatency(n: number | null): string {
  if (n === null) return "--";
  return `${n.toFixed(1)}`;
}

function formatPercent(n: number): string {
  return `${n.toFixed(2)}`;
}

/* ---------- Simple SVG Bar Chart ---------- */

function TokenChart({
  series,
}: {
  series: StatsResponse["token_series"];
}) {
  const data = series.slice(-50);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No token data available
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.tokens_in ?? 0, d.tokens_out ?? 0)),
    1,
  );

  const chartWidth = 600;
  const chartHeight = 180;
  const barGroupWidth = chartWidth / data.length;
  const barWidth = Math.max(1, barGroupWidth * 0.35);
  const gap = Math.max(0.5, barGroupWidth * 0.05);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = chartHeight - frac * chartHeight;
          return (
            <line
              key={frac}
              x1={0}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="#374151"
              strokeWidth={0.5}
            />
          );
        })}

        {data.map((d, i) => {
          const x = i * barGroupWidth;
          const inH =
            ((d.tokens_in ?? 0) / maxVal) * chartHeight;
          const outH =
            ((d.tokens_out ?? 0) / maxVal) * chartHeight;

          return (
            <g key={i}>
              {/* tokens_in bar */}
              <rect
                x={x + gap}
                y={chartHeight - inH}
                width={barWidth}
                height={inH}
                rx={1}
                fill="#3b82f6"
                opacity={0.85}
              >
                <title>
                  In: {formatNumber(d.tokens_in ?? 0)}
                </title>
              </rect>
              {/* tokens_out bar */}
              <rect
                x={x + barWidth + gap * 2}
                y={chartHeight - outH}
                width={barWidth}
                height={outH}
                rx={1}
                fill="#8b5cf6"
                opacity={0.85}
              >
                <title>
                  Out: {formatNumber(d.tokens_out ?? 0)}
                </title>
              </rect>
            </g>
          );
        })}

        {/* X-axis labels (show a few) */}
        {data
          .filter((_, i) => {
            if (data.length <= 10) return true;
            const step = Math.ceil(data.length / 6);
            return i % step === 0 || i === data.length - 1;
          })
          .map((d, _, arr) => {
            const origIdx = data.indexOf(d);
            const x = origIdx * barGroupWidth + barGroupWidth / 2;
            const date = new Date(d.timestamp);
            const label =
              arr.length <= 10
                ? date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : date.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  });
            return (
              <text
                key={origIdx}
                x={x}
                y={chartHeight + 16}
                textAnchor="middle"
                className="fill-gray-500 text-[8px]"
              >
                {label}
              </text>
            );
          })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Tokens In
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />
          Tokens Out
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [range, setRange] = useState<Range>("24h");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetcher = useCallback(() => {
    let url = `/api/stats/${encodeURIComponent(agentId!)}?range=${range}`;
    if (range === "custom" && customFrom && customTo) {
      url += `&from=${encodeURIComponent(customFrom + "T00:00:00Z")}&to=${encodeURIComponent(customTo + "T23:59:59Z")}`;
    }
    return api.get<StatsResponse>(url);
  }, [agentId, range, customFrom, customTo]);

  const { data, error, loading } = usePolling(fetcher, 3000);

  const statCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Total Requests", value: formatNumber(data.total_requests) },
      { label: "Total Errors", value: formatNumber(data.total_errors) },
      {
        label: "Error Rate (%)",
        value: formatPercent(data.error_rate),
      },
      { label: "Total Cost ($)", value: formatCost(data.total_cost) },
      { label: "Tokens Used", value: formatNumber(data.total_tokens) },
      {
        label: "P50 Latency (ms)",
        value: formatLatency(data.p50_latency),
      },
      {
        label: "P99 Latency (ms)",
        value: formatLatency(data.p99_latency),
      },
    ];
  }, [data]);

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/agents"
          className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-white">{agentId}</h1>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Range selector */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PRESET_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              r === range
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
            }`}
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => setRange("custom")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            range === "custom"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
          }`}
        >
          Custom
        </button>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-200"
            />
            <span className="text-sm text-gray-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-200"
            />
          </div>
        )}
      </div>

      {data && (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3"
              >
                <p className="text-xs text-gray-400">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Token chart */}
          <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">
              Token Usage Over Time
            </h2>
            <TokenChart series={data.token_series} />
          </div>

          {/* Cost breakdown */}
          {data.cost_by_model.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-lg border border-gray-700">
              <h2 className="bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-300">
                Cost Breakdown by Model
              </h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Cost ($)
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data.cost_by_model.map((row, i) => (
                    <tr
                      key={i}
                      className="bg-gray-900 transition-colors hover:bg-gray-800"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {row.model}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {row.provider}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatCost(row.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatNumber(row.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
