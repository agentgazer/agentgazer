import { useState, useEffect } from "react";
import { api } from "../lib/api";

// Provider names for rate limit configuration
// Keep in sync with packages/shared/src/providers.ts
const KNOWN_PROVIDER_NAMES = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "cohere",
  "deepseek",
  "moonshot",
  "zhipu",
  "minimax",
] as const;

interface RateLimit {
  agent_id: string;
  provider: string;
  max_requests: number;
  window_seconds: number;
}

interface RateLimitsResponse {
  rate_limits: RateLimit[];
}

interface RateLimitSettingsProps {
  agentId: string;
}

export default function RateLimitSettings({ agentId }: RateLimitSettingsProps) {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { max_requests: number; window_seconds: number }>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState("");
  const [newMaxRequests, setNewMaxRequests] = useState("100");
  const [newWindowSeconds, setNewWindowSeconds] = useState("60");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get<RateLimitsResponse>(`/api/agents/${encodeURIComponent(agentId)}/rate-limits`);
        setRateLimits(res.rate_limits);
        setPendingChanges({});
        setError(null);
      } catch (err) {
        setError("Failed to load rate limit settings");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [agentId]);

  const configuredProviders = new Set(rateLimits.map((r) => r.provider));
  const availableProviders = KNOWN_PROVIDER_NAMES.filter((p) => !configuredProviders.has(p));

  function handleChange(provider: string, field: "max_requests" | "window_seconds", value: string) {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue <= 0) return;

    const existing = rateLimits.find((r) => r.provider === provider);
    const current = pendingChanges[provider] ?? {
      max_requests: existing?.max_requests ?? 100,
      window_seconds: existing?.window_seconds ?? 60,
    };

    setPendingChanges((prev) => ({
      ...prev,
      [provider]: { ...current, [field]: numValue },
    }));
  }

  async function handleApply(provider: string) {
    const changes = pendingChanges[provider];
    if (!changes) return;

    setSaving(provider);
    try {
      await api.put(`/api/agents/${encodeURIComponent(agentId)}/rate-limits/${encodeURIComponent(provider)}`, changes);

      // Update local state
      setRateLimits((prev) => {
        const idx = prev.findIndex((r) => r.provider === provider);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...changes };
          return updated;
        }
        return [...prev, { agent_id: agentId, provider, ...changes }];
      });

      // Clear pending change
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
      setError(null);
    } catch (err) {
      setError("Failed to update rate limit");
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  function handleCancel(provider: string) {
    setPendingChanges((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  }

  async function handleRemove(provider: string) {
    setSaving(provider);
    try {
      await api.del(`/api/agents/${encodeURIComponent(agentId)}/rate-limits/${encodeURIComponent(provider)}`);
      setRateLimits((prev) => prev.filter((r) => r.provider !== provider));
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
      setError(null);
    } catch (err) {
      setError("Failed to remove rate limit");
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  async function handleAdd() {
    if (!newProvider) return;

    const maxReq = parseInt(newMaxRequests, 10);
    const windowSec = parseInt(newWindowSeconds, 10);
    if (isNaN(maxReq) || maxReq <= 0 || isNaN(windowSec) || windowSec <= 0) {
      setError("Invalid rate limit values");
      return;
    }

    setSaving(newProvider);
    try {
      await api.put(`/api/agents/${encodeURIComponent(agentId)}/rate-limits/${encodeURIComponent(newProvider)}`, {
        max_requests: maxReq,
        window_seconds: windowSec,
      });

      setRateLimits((prev) => [...prev, {
        agent_id: agentId,
        provider: newProvider,
        max_requests: maxReq,
        window_seconds: windowSec,
      }]);

      setShowAddForm(false);
      setNewProvider("");
      setNewMaxRequests("100");
      setNewWindowSeconds("60");
      setError(null);
    } catch (err) {
      setError("Failed to add rate limit");
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">Rate Limits</h2>
        <p className="mt-2 text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300">Rate Limits</h2>
      <p className="mt-1 text-xs text-gray-500">
        Limit requests per provider for this agent. Requests exceeding the limit will receive a 429 response.
      </p>

      {error && (
        <div className="mt-2 rounded bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {rateLimits.map((rl) => {
          const isSaving = saving === rl.provider;
          const hasPendingChange = rl.provider in pendingChanges;
          const displayMaxReq = hasPendingChange ? pendingChanges[rl.provider].max_requests : rl.max_requests;
          const displayWindowSec = hasPendingChange ? pendingChanges[rl.provider].window_seconds : rl.window_seconds;

          return (
            <div
              key={rl.provider}
              className="rounded-lg border border-gray-600 bg-gray-900 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium capitalize text-white">
                    {rl.provider}
                  </span>
                  {hasPendingChange && (
                    <span className="ml-2 rounded bg-yellow-900 px-2 py-0.5 text-xs text-yellow-200">
                      Unsaved
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(rl.provider)}
                  disabled={isSaving}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  className="w-20 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  value={displayMaxReq}
                  onChange={(e) => handleChange(rl.provider, "max_requests", e.target.value)}
                  disabled={isSaving}
                />
                <span className="text-xs text-gray-400">requests per</span>
                <input
                  type="number"
                  min="1"
                  className="w-20 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  value={displayWindowSec}
                  onChange={(e) => handleChange(rl.provider, "window_seconds", e.target.value)}
                  disabled={isSaving}
                />
                <span className="text-xs text-gray-400">seconds</span>

                {hasPendingChange && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApply(rl.provider)}
                      disabled={isSaving}
                      className="ml-2 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {isSaving ? "Applying..." : "Apply"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(rl.provider)}
                      disabled={isSaving}
                      className="rounded-md border border-gray-600 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {rateLimits.length === 0 && !showAddForm && (
          <p className="text-sm text-gray-400">
            No rate limits configured. Add one to limit request frequency.
          </p>
        )}

        {showAddForm && (
          <div className="rounded-lg border border-gray-600 bg-gray-900 p-3">
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
              >
                <option value="">Select provider</option>
                {availableProviders.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="Max requests"
                className="w-20 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                value={newMaxRequests}
                onChange={(e) => setNewMaxRequests(e.target.value)}
              />
              <span className="text-xs text-gray-400">per</span>
              <input
                type="number"
                min="1"
                placeholder="Seconds"
                className="w-20 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                value={newWindowSeconds}
                onChange={(e) => setNewWindowSeconds(e.target.value)}
              />
              <span className="text-xs text-gray-400">sec</span>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newProvider || saving === newProvider}
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-md border border-gray-600 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showAddForm && availableProviders.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Rate Limit
          </button>
        )}
      </div>
    </div>
  );
}
