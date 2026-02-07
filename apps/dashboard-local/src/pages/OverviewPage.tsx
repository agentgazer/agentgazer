import { useCallback } from "react";
import { overviewApi, type OverviewData, type RecentEvent } from "../lib/api";
import { formatCost } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import SummaryCard from "../components/SummaryCard";
import RecentEventsTimeline from "../components/RecentEventsTimeline";
import TopRankingChart from "../components/TopRankingChart";
import TrendChart from "../components/TrendChart";

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
}

export default function OverviewPage() {
  const overviewFetcher = useCallback(() => overviewApi.getData(), []);
  const eventsFetcher = useCallback(
    () => overviewApi.getRecentEvents(10),
    []
  );

  const {
    data: overview,
    error: overviewError,
    loading: overviewLoading,
  } = usePolling<OverviewData>(overviewFetcher, 3000);

  const {
    data: eventsData,
    error: eventsError,
    loading: eventsLoading,
  } = usePolling<{ events: RecentEvent[] }>(eventsFetcher, 3000);

  const isLoading = overviewLoading && !overview;

  if (isLoading) return <LoadingSpinner />;

  const costTrend = overview
    ? calculateTrend(overview.today_cost, overview.yesterday_cost)
    : 0;
  const requestsTrend = overview
    ? calculateTrend(overview.today_requests, overview.yesterday_requests)
    : 0;

  const topAgentsItems = (overview?.top_agents ?? []).map((a) => ({
    label: a.agent_id,
    value: a.cost,
    formattedValue: formatCost(a.cost),
    percentage: a.percentage,
    link: `/agents/${encodeURIComponent(a.agent_id)}`,
  }));

  const topModelsItems = (overview?.top_models ?? []).map((m) => ({
    label: m.model,
    value: m.tokens,
    formattedValue: formatTokens(m.tokens),
    percentage: m.percentage,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Overview</h1>

      {/* Error banners */}
      {overviewError && (
        <ErrorBanner message={`Overview: ${overviewError}`} />
      )}
      {eventsError && (
        <ErrorBanner message={`Events: ${eventsError}`} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Active Agents"
          value={overview?.active_agents.toString() ?? "0"}
        />
        <SummaryCard
          title="Today's Cost"
          value={formatCost(overview?.today_cost ?? 0)}
          trend={{ value: costTrend, label: "vs yesterday" }}
        />
        <SummaryCard
          title="Requests (24h)"
          value={(overview?.today_requests ?? 0).toLocaleString()}
          trend={{ value: requestsTrend, label: "vs yesterday" }}
        />
        <SummaryCard
          title="Error Rate"
          value={`${(overview?.error_rate ?? 0).toFixed(1)}%`}
          warning={(overview?.error_rate ?? 0) > 5}
          warningText="Above 5% threshold"
        />
      </div>

      {/* Middle Section: Events + Rankings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Events */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-400">
            Recent Events
          </h3>
          {eventsLoading && !eventsData ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
            </div>
          ) : (
            <RecentEventsTimeline events={eventsData?.events ?? []} />
          )}
        </div>

        {/* Rankings */}
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <TopRankingChart
              title="Top Agents (by cost)"
              items={topAgentsItems}
              emptyText="No agent data"
            />
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <TopRankingChart
              title="Top Models (by tokens)"
              items={topModelsItems}
              emptyText="No model data"
            />
          </div>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <TrendChart
            title="Cost Trend (7 days)"
            data={overview?.cost_trend ?? []}
            color="#10b981"
            formatValue={(v) => formatCost(v)}
          />
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <TrendChart
            title="Requests Trend (7 days)"
            data={overview?.requests_trend ?? []}
            color="#3b82f6"
            formatValue={(v) => v.toLocaleString()}
          />
        </div>
      </div>
    </div>
  );
}
