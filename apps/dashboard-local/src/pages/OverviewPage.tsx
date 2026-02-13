import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      <h1 className="text-2xl font-bold text-white">{t("overview.title")}</h1>

      {/* Error banners */}
      {overviewError && (
        <ErrorBanner message={`${t("overview.title")}: ${overviewError}`} />
      )}
      {eventsError && (
        <ErrorBanner message={`${t("nav.events")}: ${eventsError}`} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title={t("overview.activeAgents")}
          value={overview?.active_agents.toString() ?? "0"}
        />
        <SummaryCard
          title={t("overview.todaysCost")}
          value={formatCost(overview?.today_cost ?? 0)}
          trend={{ value: costTrend, label: t("overview.vsYesterday") }}
        />
        <SummaryCard
          title={t("overview.requests24h")}
          value={(overview?.today_requests ?? 0).toLocaleString()}
          trend={{ value: requestsTrend, label: t("overview.vsYesterday") }}
        />
        <SummaryCard
          title={t("overview.errorRate")}
          value={`${(overview?.error_rate ?? 0).toFixed(1)}%`}
          warning={(overview?.error_rate ?? 0) > 5}
          warningText={t("overview.aboveThreshold")}
        />
      </div>

      {/* Middle Section: Events + Rankings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Events */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wide text-gray-400">
              {t("overview.recentEvents")}
            </h3>
            <Link
              to="/events"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {t("common.viewAll")}
            </Link>
          </div>
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
              title={t("overview.topAgentsByCost")}
              items={topAgentsItems}
              emptyText={t("overview.noAgentData")}
            />
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <TopRankingChart
              title={t("overview.topModelsByTokens")}
              items={topModelsItems}
              emptyText={t("overview.noModelData")}
            />
          </div>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <TrendChart
            title={t("overview.costTrend7d")}
            data={overview?.cost_trend ?? []}
            color="#10b981"
            formatValue={(v) => formatCost(v)}
          />
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <TrendChart
            title={t("overview.requestsTrend7d")}
            data={overview?.requests_trend ?? []}
            color="#3b82f6"
            formatValue={(v) => v.toLocaleString()}
          />
        </div>
      </div>
    </div>
  );
}
