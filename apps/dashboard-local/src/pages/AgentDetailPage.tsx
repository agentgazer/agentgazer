import { useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatCost, formatNumber } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import TimeRangeSelector from "../components/TimeRangeSelector";
import TokenBarChart from "../components/charts/TokenBarChart";

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

function formatLatency(n: number | null): string {
  if (n === null) return "--";
  return `${n.toFixed(1)}`;
}

function formatPercent(n: number): string {
  return `${n.toFixed(2)}`;
}

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
      <div className="mt-6">
        <TimeRangeSelector
          value={range}
          onChange={setRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
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
            <TokenBarChart series={data.token_series} />
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
