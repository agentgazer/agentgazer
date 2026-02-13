import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { eventsApi, api, type EventRow, type EventsQueryParams } from "../lib/api";
import { formatCost, formatTimestamp } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

interface PayloadData {
  id: string;
  event_id: string;
  agent_id: string;
  request_body: string | null;
  response_body: string | null;
  size_bytes: number;
  purpose: string;
  created_at: string;
}

function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

const EVENT_TYPES = [
  "llm_call",
  "completion",
  "heartbeat",
  "error",
  "custom",
  "blocked",
  "kill_switch",
  "security_blocked",
];

const TIME_RANGES = [
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

function getTimeRangeFrom(range: string): string | undefined {
  const now = new Date();
  switch (range) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

function getStatusColor(statusCode: number | null, eventType: string): string {
  if (eventType === "error" || eventType === "kill_switch" || eventType === "blocked") {
    return "text-red-400";
  }
  if (statusCode === null) return "text-gray-400";
  if (statusCode >= 400) return "text-red-400";
  if (statusCode >= 200 && statusCode < 300) return "text-green-400";
  return "text-yellow-400";
}

const PAGE_SIZE = 50;

export default function LogsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payload modal state
  const [selectedPayload, setSelectedPayload] = useState<PayloadData | null>(null);
  const [payloadLoading, setPayloadLoading] = useState<string | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const loadPayload = useCallback(async (eventId: string) => {
    setPayloadLoading(eventId);
    setPayloadError(null);
    try {
      const payload = await api.get<PayloadData>(`/api/payloads/${eventId}`);
      setSelectedPayload(payload);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setPayloadError("Payload not found. Archive may be disabled or data expired.");
      } else {
        setPayloadError(err instanceof Error ? err.message : "Failed to load payload");
      }
    } finally {
      setPayloadLoading(null);
    }
  }, []);

  // Filters
  const [agents, setAgents] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const [search, setSearch] = useState("");

  // Load agent and provider lists for filters
  useEffect(() => {
    api.get<{ agents: { agent_id: string }[] }>("/api/agents").then((data) => {
      setAgents(data.agents.map((a) => a.agent_id));
    });
    api.get<{ providers: { name: string }[] }>("/api/providers").then((data) => {
      setProviders(data.providers.map((p) => p.name));
    });
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: EventsQueryParams = {
        limit: PAGE_SIZE,
        offset,
      };
      if (selectedAgent) params.agent_id = selectedAgent;
      if (selectedType) params.event_type = selectedType;
      if (selectedProvider) params.provider = selectedProvider;
      if (search) params.search = search;
      const from = getTimeRangeFrom(selectedTimeRange);
      if (from) params.from = from;

      const result = await eventsApi.query(params);
      setEvents(result.events);
      setTotal(result.total);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [offset, selectedAgent, selectedType, selectedProvider, selectedTimeRange, search]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [selectedAgent, selectedType, selectedProvider, selectedTimeRange, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleExport = () => {
    const params: EventsQueryParams = {};
    if (selectedAgent) params.agent_id = selectedAgent;
    if (selectedType) params.event_type = selectedType;
    if (selectedProvider) params.provider = selectedProvider;
    const from = getTimeRangeFrom(selectedTimeRange);
    if (from) params.from = from;

    const url = eventsApi.exportCsv(params);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("events.title")}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {t("events.subtitle")}{" "}
            <Link to="/security" className="text-blue-400 hover:text-blue-300">
              {t("events.viewSecurityEvents")} →
            </Link>
          </p>
        </div>
        <button
          onClick={handleExport}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600"
        >
          {t("common.export")}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 p-3">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white"
        >
          <option value="">All Types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white"
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={selectedTimeRange}
          onChange={(e) => setSelectedTimeRange(e.target.value)}
          className="rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white"
        >
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[150px] rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white placeholder-gray-400"
        />
      </div>

      {/* Table */}
      {loading && events.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">{t("events.time")}</th>
                <th className="px-3 py-2">{t("events.agent")}</th>
                <th className="px-3 py-2">{t("events.type")}</th>
                <th className="px-3 py-2">{t("events.provider")}</th>
                <th className="px-3 py-2">{t("events.model")}</th>
                <th className="px-3 py-2">{t("events.status")}</th>
                <th className="px-3 py-2 text-right">{t("events.tokensIn")}</th>
                <th className="px-3 py-2 text-right">{t("events.tokensOut")}</th>
                <th className="px-3 py-2 text-right">{t("events.cost")}</th>
                <th className="px-3 py-2 text-right">{t("events.latency")}</th>
                <th className="px-3 py-2 text-center">{t("events.payload")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    {t("events.noEvents")}
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="bg-gray-900 hover:bg-gray-800">
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/agents/${encodeURIComponent(event.agent_id)}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {event.agent_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      {event.event_type === "kill_switch" ? (
                        <Link
                          to={`/incidents/${event.id}`}
                          className="text-red-400 hover:text-red-300 underline"
                        >
                          {event.event_type}
                        </Link>
                      ) : (
                        event.event_type
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{event.provider ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-400 max-w-[150px] truncate">
                      {event.model ?? "-"}
                    </td>
                    <td className={`px-3 py-2 ${getStatusColor(event.status_code, event.event_type)}`}>
                      {event.status_code ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {event.tokens_in?.toLocaleString() ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {event.tokens_out?.toLocaleString() ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {event.cost_usd != null ? formatCost(event.cost_usd) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {event.latency_ms != null ? `${event.latency_ms.toLocaleString()}ms` : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => loadPayload(event.id)}
                        disabled={payloadLoading === event.id}
                        className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-indigo-300 disabled:opacity-50"
                        title="View payload"
                      >
                        {payloadLoading === event.id ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {t("common.showing", { start: offset + 1, end: Math.min(offset + PAGE_SIZE, total), total: total.toLocaleString() })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.previous")}
            </button>
            <span className="px-2 py-1">
              {t("common.page", { current: currentPage, total: totalPages })}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Payload Modal */}
      {(selectedPayload || payloadError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            setSelectedPayload(null);
            setPayloadError(null);
          }}
        >
          <div
            className="mx-4 max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-200">
                {payloadError ? "Error" : "Request / Response Payload"}
              </h3>
              <button
                onClick={() => {
                  setSelectedPayload(null);
                  setPayloadError(null);
                }}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[calc(80vh-60px)] overflow-y-auto p-4">
              {payloadError ? (
                <div className="rounded bg-red-900/50 px-4 py-3 text-sm text-red-300">
                  {payloadError}
                </div>
              ) : selectedPayload && (
                <div className="space-y-4">
                  {/* Meta info */}
                  <div className="text-xs text-gray-500">
                    Event ID: {selectedPayload.event_id} | Size: {(selectedPayload.size_bytes / 1024).toFixed(1)} KB | {selectedPayload.created_at}
                  </div>

                  {/* Request */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">
                      Request
                      {selectedPayload.request_body && (
                        <span className="ml-2 font-normal normal-case text-gray-500">
                          ({selectedPayload.request_body.length.toLocaleString()} chars)
                        </span>
                      )}
                    </h4>
                    <pre className="max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                      {selectedPayload.request_body
                        ? formatJSON(selectedPayload.request_body)
                        : "(No request body)"}
                    </pre>
                  </div>

                  {/* Response */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">
                      Response
                      {selectedPayload.response_body && (
                        <span className="ml-2 font-normal normal-case text-gray-500">
                          ({selectedPayload.response_body.length.toLocaleString()} chars)
                        </span>
                      )}
                    </h4>
                    <pre className="max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                      {selectedPayload.response_body
                        ? formatJSON(selectedPayload.response_body)
                        : "(No response body)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
