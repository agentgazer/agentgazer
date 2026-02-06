import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { relativeTime, formatCost } from "../lib/format";

interface Event {
  id: string;
  timestamp: string;
  provider: string | null;
  model: string | null;
  requested_model: string | null;
  tokens_total: number | null;
  cost_usd: number | null;
  status_code: number | null;
  latency_ms: number | null;
}

interface EventsResponse {
  events: Event[];
}

interface RequestLogProps {
  agentId: string;
}

export default function RequestLog({ agentId }: RequestLogProps) {
  const [limit] = useState(20);

  const fetcher = useCallback(() => {
    return api.get<EventsResponse>(
      `/api/events?agent_id=${encodeURIComponent(agentId)}&event_type=llm_call&limit=${limit}`
    );
  }, [agentId, limit]);

  const { data, loading, error, refresh } = usePolling(fetcher, 5000);

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">Request Log</h2>
        <p className="mt-2 text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  const events = data?.events ?? [];

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-300">Request Log</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Last {limit} LLM calls</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50"
            title="Reload"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="px-4 pb-4 text-sm text-gray-400">
          No LLM calls recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-t border-gray-700 bg-gray-900 text-xs uppercase text-gray-400">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium text-right">Tokens</th>
                <th className="px-4 py-2 font-medium text-right">Cost</th>
                <th className="px-4 py-2 font-medium text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {events.map((event) => {
                const hasOverride =
                  event.requested_model &&
                  event.model &&
                  event.requested_model !== event.model;

                return (
                  <tr
                    key={event.id}
                    className="bg-gray-900 transition-colors hover:bg-gray-800"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-gray-300">
                      {relativeTime(event.timestamp)}
                    </td>
                    <td className="px-4 py-2 text-gray-300">
                      {event.provider ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      {hasOverride ? (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 line-through">
                            {event.requested_model}
                          </span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className="font-medium text-indigo-300">
                            {event.model}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">
                          {event.model ?? "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-300">
                      {event.tokens_total?.toLocaleString() ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-300">
                      {event.cost_usd != null ? formatCost(event.cost_usd) : "-"}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-300">
                      {event.latency_ms != null ? `${event.latency_ms}ms` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
