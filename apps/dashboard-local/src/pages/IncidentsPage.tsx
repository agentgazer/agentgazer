import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { eventsApi, type EventRow } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

interface KillSwitchTags {
  loop_score?: number;
  threshold?: number;
  window_size?: number;
  similar_prompts?: number;
  similar_responses?: number;
  repeated_tool_calls?: number;
}

export default function IncidentsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await eventsApi.query({
        event_type: "kill_switch",
        limit: 100,
      });
      setEvents(result.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <button
          onClick={loadIncidents}
          disabled={loading}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-gray-400">
        Kill switch events triggered by loop detection. Click to view scoring details and evidence.
      </p>

      {error && <ErrorBanner message={error} />}

      {loading && events.length === 0 ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-300">No incidents</h3>
          <p className="mt-2 text-sm text-gray-500">
            No kill switch events have been triggered yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Window</th>
                <th className="px-4 py-3 text-center">Signals</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {events.map((event) => {
                const tags: KillSwitchTags =
                  typeof event.tags === "object" && event.tags !== null
                    ? (event.tags as KillSwitchTags)
                    : {};

                const loopScore = tags.loop_score ?? 0;
                const threshold = tags.threshold ?? 10;
                const windowSize = tags.window_size ?? 10;
                const similarPrompts = tags.similar_prompts ?? 0;
                const similarResponses = tags.similar_responses ?? 0;
                const repeatedToolCalls = tags.repeated_tool_calls ?? 0;

                return (
                  <tr key={event.id} className="bg-gray-900 hover:bg-gray-800">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/agents/${encodeURIComponent(event.agent_id)}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {event.agent_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {event.provider ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-[150px] truncate">
                      {event.model ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-red-400 font-medium">
                        {loopScore.toFixed(1)}
                      </span>
                      <span className="text-gray-500">/{threshold}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {windowSize}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        {similarPrompts > 0 && (
                          <span className="rounded bg-yellow-900/50 px-1.5 py-0.5 text-yellow-300" title="Similar prompts">
                            P:{similarPrompts}
                          </span>
                        )}
                        {similarResponses > 0 && (
                          <span className="rounded bg-orange-900/50 px-1.5 py-0.5 text-orange-300" title="Similar responses">
                            R:{similarResponses}
                          </span>
                        )}
                        {repeatedToolCalls > 0 && (
                          <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-red-300" title="Repeated tool calls">
                            T:{repeatedToolCalls}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/incidents/${event.id}`}
                        className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                      >
                        View Details
                      </Link>
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
