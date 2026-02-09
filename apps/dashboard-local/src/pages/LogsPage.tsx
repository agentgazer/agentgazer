import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { eventsApi, api, type EventRow, type EventsQueryParams } from "../lib/api";
import { formatCost } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

const EVENT_TYPES = [
  "llm_call",
  "completion",
  "heartbeat",
  "error",
  "custom",
  "blocked",
  "kill_switch",
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

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString();
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
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="text-2xl font-bold text-white">Events</h1>
        <button
          onClick={handleExport}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600"
        >
          Export CSV
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
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No events found
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
                    <td className="px-3 py-2 text-gray-300">{event.event_type}</td>
                    <td className="px-3 py-2 text-gray-400">{event.provider ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-400 max-w-[150px] truncate">
                      {event.model ?? "-"}
                    </td>
                    <td className={`px-3 py-2 ${getStatusColor(event.status_code, event.event_type)}`}>
                      {event.status_code ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {event.cost_usd != null ? formatCost(event.cost_usd) : "-"}
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
            Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-2 py-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
