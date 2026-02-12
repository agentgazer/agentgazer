import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type EventRow } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

interface EvidencePayload {
  id: string;
  event_id: string;
  agent_id: string;
  request_body: string | null;
  response_body: string | null;
  size_bytes: number;
  purpose: string;
  created_at: string;
}

interface EvidenceResponse {
  killSwitchEventId: string;
  payloads: EvidencePayload[];
  count: number;
}

interface KillSwitchTags {
  loop_score?: number;
  similar_prompts?: number;
  similar_responses?: number;
  repeated_tool_calls?: number;
  window_size?: number;
  threshold?: number;
}

// Scoring weights (must match loop-detector.ts)
const WEIGHTS = {
  PROMPT_SIMILARITY: 1.0,
  RESPONSE_SIMILARITY: 2.0,
  TOOL_CALL_REPETITION: 1.5,
};

function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export default function IncidentPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [evidence, setEvidence] = useState<EvidencePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      // Load kill switch event details
      const eventsResult = await api.get<{ events: EventRow[] }>(
        `/api/events?limit=1&search=${encodeURIComponent(eventId)}`
      );

      if (eventsResult.events.length === 0) {
        setError("Kill switch event not found");
        return;
      }

      const killSwitchEvent = eventsResult.events[0];
      if (killSwitchEvent.event_type !== "kill_switch") {
        setError("Event is not a kill switch event");
        return;
      }

      setEvent(killSwitchEvent);

      // Load evidence payloads
      const evidenceResult = await api.get<EvidenceResponse>(
        `/api/payloads/evidence/${eventId}`
      );
      setEvidence(evidenceResult.payloads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incident data");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/events" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Events
        </Link>
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!event) {
    return null;
  }

  // Parse tags for scoring details
  const tags: KillSwitchTags = typeof event.tags === "object" && event.tags !== null
    ? event.tags as KillSwitchTags
    : {};

  const loopScore = tags.loop_score ?? 0;
  const similarPrompts = tags.similar_prompts ?? 0;
  const similarResponses = tags.similar_responses ?? 0;
  const repeatedToolCalls = tags.repeated_tool_calls ?? 0;
  const windowSize = tags.window_size ?? 10;
  const threshold = tags.threshold ?? 10;

  // Calculate individual scores
  const promptScore = similarPrompts * WEIGHTS.PROMPT_SIMILARITY;
  const responseScore = similarResponses * WEIGHTS.RESPONSE_SIMILARITY;
  const toolCallScore = repeatedToolCalls * WEIGHTS.TOOL_CALL_REPETITION;
  const percentage = Math.min(100, (loopScore / threshold) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/events" className="text-gray-400 hover:text-gray-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-red-400">Kill Switch Incident</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Agent: <Link to={`/agents/${encodeURIComponent(event.agent_id)}`} className="text-blue-400 hover:text-blue-300">{event.agent_id}</Link>
              {" | "}Triggered: {formatTimestamp(event.timestamp)}
            </p>
          </div>
        </div>
      </div>

      {/* Scoring Breakdown */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Scoring Breakdown</h2>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">Loop Score</span>
            <span className="text-white font-medium">
              {loopScore.toFixed(1)} / {threshold.toFixed(1)}
              <span className="text-gray-500 ml-2">({percentage.toFixed(0)}%)</span>
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-red-500 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Scoring table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left py-2 px-2">Signal</th>
                <th className="text-right py-2 px-2">Count</th>
                <th className="text-right py-2 px-2">Weight</th>
                <th className="text-right py-2 px-2">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              <tr className="text-gray-300">
                <td className="py-2 px-2">Similar Prompts</td>
                <td className="py-2 px-2 text-right">{similarPrompts}</td>
                <td className="py-2 px-2 text-right text-gray-500">&times;{WEIGHTS.PROMPT_SIMILARITY.toFixed(1)}</td>
                <td className="py-2 px-2 text-right font-medium">{promptScore.toFixed(1)}</td>
              </tr>
              <tr className="text-gray-300">
                <td className="py-2 px-2">Similar Responses</td>
                <td className="py-2 px-2 text-right">{similarResponses}</td>
                <td className="py-2 px-2 text-right text-gray-500">&times;{WEIGHTS.RESPONSE_SIMILARITY.toFixed(1)}</td>
                <td className="py-2 px-2 text-right font-medium">{responseScore.toFixed(1)}</td>
              </tr>
              <tr className="text-gray-300">
                <td className="py-2 px-2">Repeated Tool Calls</td>
                <td className="py-2 px-2 text-right">{repeatedToolCalls}</td>
                <td className="py-2 px-2 text-right text-gray-500">&times;{WEIGHTS.TOOL_CALL_REPETITION.toFixed(1)}</td>
                <td className="py-2 px-2 text-right font-medium">{toolCallScore.toFixed(1)}</td>
              </tr>
              <tr className="text-white font-semibold border-t-2 border-gray-600">
                <td className="py-2 px-2">Total</td>
                <td className="py-2 px-2"></td>
                <td className="py-2 px-2"></td>
                <td className="py-2 px-2 text-right text-red-400">{loopScore.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Formula explanation */}
        <div className="bg-gray-900 rounded p-3 text-xs">
          <p className="text-gray-400 mb-2">
            <span className="text-gray-300 font-medium">Formula:</span>{" "}
            score = prompts &times; {WEIGHTS.PROMPT_SIMILARITY} + responses &times; {WEIGHTS.RESPONSE_SIMILARITY} + toolCalls &times; {WEIGHTS.TOOL_CALL_REPETITION}
          </p>
          <p className="text-gray-500">
            Window Size: {windowSize} recent requests analyzed | Threshold: {threshold.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Evidence Payloads */}
      <div className="rounded-lg border border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">
            Evidence Payloads
            <span className="ml-2 text-gray-500 font-normal">
              ({evidence.length} similar requests)
            </span>
          </h2>
        </div>

        {evidence.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No evidence payloads found. Payload archiving may be disabled.
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {evidence.map((payload, index) => (
              <div key={payload.id} className="bg-gray-900">
                {/* Payload header - clickable to expand */}
                <button
                  onClick={() => setExpandedPayload(expandedPayload === payload.id ? null : payload.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs w-6">#{index + 1}</span>
                    <div>
                      <span className="text-gray-300 text-sm">
                        Event: {payload.event_id.slice(0, 8)}...
                      </span>
                      <span className="text-gray-500 text-xs ml-3">
                        {(payload.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${expandedPayload === payload.id ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded payload content */}
                {expandedPayload === payload.id && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Request */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">
                        Request
                        {payload.request_body && (
                          <span className="ml-2 font-normal normal-case text-gray-500">
                            ({payload.request_body.length.toLocaleString()} chars)
                          </span>
                        )}
                      </h4>
                      <pre className="max-h-48 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">
                        {payload.request_body
                          ? formatJSON(payload.request_body)
                          : "(No request body)"}
                      </pre>
                    </div>

                    {/* Response */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">
                        Response
                        {payload.response_body && (
                          <span className="ml-2 font-normal normal-case text-gray-500">
                            ({payload.response_body.length.toLocaleString()} chars)
                          </span>
                        )}
                      </h4>
                      <pre className="max-h-48 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">
                        {payload.response_body
                          ? formatJSON(payload.response_body)
                          : "(No response body)"}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event metadata */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Event Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Event ID:</span>
            <span className="text-gray-300 ml-2 font-mono text-xs">{event.id}</span>
          </div>
          <div>
            <span className="text-gray-500">Source:</span>
            <span className="text-gray-300 ml-2">{event.source}</span>
          </div>
          <div>
            <span className="text-gray-500">Provider:</span>
            <span className="text-gray-300 ml-2">{event.provider ?? "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Model:</span>
            <span className="text-gray-300 ml-2">{event.model ?? "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
