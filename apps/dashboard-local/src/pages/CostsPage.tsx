import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { formatCost, formatNumber } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import TimeRangeSelector from "../components/TimeRangeSelector";
import FilterDropdown from "../components/FilterDropdown";
import CostAreaChart from "../components/charts/CostAreaChart";

type Range = "1h" | "24h" | "7d" | "30d";

interface CostByModel {
  model: string;
  provider: string;
  cost: number;
  count: number;
}

interface CostSeriesEntry {
  timestamp: string;
  cost: number;
  tokens: number;
}

interface OverviewResponse {
  total_cost: number;
  total_tokens: number;
  total_requests: number;
  avg_cost_per_request: number;
  active_models: number;
  cost_by_model: CostByModel[];
  cost_series: CostSeriesEntry[];
  available_models: string[];
}

export default function CostsPage() {
  const [range, setRange] = useState<Range>("24h");
  const [modelFilter, setModelFilter] = useState("");

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (modelFilter) params.set("model", modelFilter);
    return api.get<OverviewResponse>(`/api/stats/overview?${params.toString()}`);
  }, [range, modelFilter]);

  const { data, error, loading } = usePolling(fetcher, 10000);

  const modelOptions = (data?.available_models ?? []).map((m) => ({
    value: m,
    label: m,
  }));

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Costs</h1>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <TimeRangeSelector
          value={range}
          onChange={(r) => setRange(r as Range)}
          showCustom={false}
        />
        {modelOptions.length > 0 && (
          <FilterDropdown
            value={modelFilter}
            onChange={setModelFilter}
            options={modelOptions}
            label="Models"
          />
        )}
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Total Cost</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCost(data.total_cost)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Avg Cost / Request</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCost(data.avg_cost_per_request)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Total Tokens</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatNumber(data.total_tokens)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Active Models</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {data.active_models}
              </p>
            </div>
          </div>

          {/* Cost Trend Chart */}
          <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">
              Cost Trend
            </h2>
            <CostAreaChart series={data.cost_series} />
          </div>

          {/* Cost by Model Table */}
          {data.cost_by_model.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-lg border border-gray-700">
              <h2 className="bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-300">
                Cost by Model
              </h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium text-right">Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data.cost_by_model.map((row) => (
                    <tr
                      key={`${row.model}-${row.provider}`}
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

          {data.cost_by_model.length === 0 && (
            <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
              <p className="text-gray-400">No cost data available for this period.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
