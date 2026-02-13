import { useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatCost, formatNumber } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import TimeRangeSelector from "../components/TimeRangeSelector";
import TokenBarChart from "../components/charts/TokenBarChart";
import PolicySettings from "../components/PolicySettings";
import KillSwitchSettings from "../components/KillSwitchSettings";
import ModelSettings from "../components/ModelSettings";
import RateLimitSettings from "../components/RateLimitSettings";
import RequestLog from "../components/RequestLog";

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
  blocked_count: number;
  block_reasons: Record<string, number>;
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
  const { t } = useTranslation();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("24h");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!agentId) return;

    const confirmed = window.confirm(
      t("agentDetail.deleteConfirm", { agent: agentId })
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.delete(`/api/agents/${encodeURIComponent(agentId)}`);
      navigate("/agents");
    } catch (err) {
      alert(t("agentDetail.deleteFailed", { error: String(err) }));
      setDeleting(false);
    }
  };

  const fetcher = useCallback(() => {
    if (!agentId) return Promise.reject(new Error("Missing agentId"));
    let url = `/api/stats/${encodeURIComponent(agentId)}?range=${range}`;
    if (range === "custom" && customFrom && customTo) {
      url += `&from=${encodeURIComponent(customFrom + "T00:00:00Z")}&to=${encodeURIComponent(customTo + "T23:59:59Z")}`;
    }
    return api.get<StatsResponse>(url);
  }, [agentId, range, customFrom, customTo]);

  const { data, error, loading } = usePolling(fetcher, 3000);

  const statCards = useMemo(() => {
    if (!data) return [];
    const cards = [
      { label: t("agentDetail.totalRequests"), value: formatNumber(data.total_requests) },
      { label: t("agentDetail.totalErrors"), value: formatNumber(data.total_errors) },
      {
        label: t("agentDetail.errorRate"),
        value: formatPercent(data.error_rate),
      },
      { label: t("agentDetail.totalCost"), value: formatCost(data.total_cost) },
      { label: t("agentDetail.tokensUsed"), value: formatNumber(data.total_tokens) },
      {
        label: t("agentDetail.p50Latency"),
        value: formatLatency(data.p50_latency),
      },
      {
        label: t("agentDetail.p99Latency"),
        value: formatLatency(data.p99_latency),
      },
    ];
    // Add blocked count if there are any
    if (data.blocked_count > 0) {
      cards.push({
        label: t("agentDetail.blockedRequests"),
        value: formatNumber(data.blocked_count),
      });
    }
    return cards;
  }, [data, t]);

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/agents"
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
          >
            &larr; {t("agentDetail.back")}
          </Link>
          <h1 className="text-2xl font-bold text-white">{agentId}</h1>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? t("agentDetail.deleting") : t("agentDetail.deleteAgent")}
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Model Settings */}
      <div className="mt-6">
        <ModelSettings agentId={agentId!} />
      </div>

      {/* Policy Settings */}
      <div className="mt-6">
        <PolicySettings agentId={agentId!} />
      </div>

      {/* Kill Switch Settings */}
      <div className="mt-6">
        <KillSwitchSettings agentId={agentId!} />
      </div>

      {/* Rate Limit Settings */}
      <div className="mt-6">
        <RateLimitSettings agentId={agentId!} />
      </div>

      {/* Request Log */}
      <div className="mt-6">
        <RequestLog agentId={agentId!} />
      </div>

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
              {t("agentDetail.tokenUsageOverTime")}
            </h2>
            <TokenBarChart series={data.token_series} />
          </div>

          {/* Cost breakdown */}
          {data.cost_by_model.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-lg border border-gray-700">
              <h2 className="bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-300">
                {t("agentDetail.costBreakdownByModel")}
              </h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                    <th className="px-4 py-3 font-medium">{t("agentDetail.model")}</th>
                    <th className="px-4 py-3 font-medium">{t("agentDetail.provider")}</th>
                    <th className="px-4 py-3 font-medium text-right">
                      {t("agentDetail.cost")}
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      {t("agentDetail.count")}
                    </th>
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

          {/* Blocked requests breakdown */}
          {data.blocked_count > 0 && Object.keys(data.block_reasons).length > 0 && (
            <div className="mt-8 overflow-hidden rounded-lg border border-gray-700">
              <h2 className="bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-300">
                {t("agentDetail.blockedRequestsByReason")}
              </h2>
              <div className="bg-gray-900 p-4">
                <div className="flex flex-wrap gap-4">
                  {Object.entries(data.block_reasons).map(([reason, count]) => (
                    <div
                      key={reason}
                      className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-red-400">
                        {reason.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full bg-red-800 px-2 py-0.5 text-xs font-medium text-white">
                        {formatNumber(count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
