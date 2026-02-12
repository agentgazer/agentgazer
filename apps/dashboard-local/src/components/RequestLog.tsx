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

interface RequestLogProps {
  agentId: string;
}

export default function RequestLog({ agentId }: RequestLogProps) {
  const [limit] = useState(20);
  const [selectedPayload, setSelectedPayload] = useState<PayloadData | null>(null);
  const [payloadLoading, setPayloadLoading] = useState<string | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    return api.get<EventsResponse>(
      `/api/events?agent_id=${encodeURIComponent(agentId)}&event_type=llm_call&limit=${limit}`
    );
  }, [agentId, limit]);

  const { data, loading, error, refresh } = usePolling(fetcher, 5000);

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
                <th className="px-4 py-2 font-medium text-center">Payload</th>
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
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => loadPayload(event.id)}
                        disabled={payloadLoading === event.id}
                        className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-indigo-300 disabled:opacity-50"
                        title="View payload"
                      >
                        {payloadLoading === event.id ? (
                          <svg
                            className="h-4 w-4 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zM9 12h6M12 9v6"
                            />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
