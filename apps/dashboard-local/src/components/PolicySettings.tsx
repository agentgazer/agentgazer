import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { formatCost } from "../lib/format";

interface PolicyData {
  active: boolean;
  budget_limit: number | null;
  allowed_hours_start: number | null;
  allowed_hours_end: number | null;
  daily_spend: number;
}

interface PolicySettingsProps {
  agentId: string;
}

export default function PolicySettings({ agentId }: PolicySettingsProps) {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [active, setActive] = useState(true);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState("");
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [hoursStart, setHoursStart] = useState("9");
  const [hoursEnd, setHoursEnd] = useState("17");

  const fetchPolicy = useCallback(async () => {
    try {
      const data = await api.get<PolicyData>(
        `/api/agents/${encodeURIComponent(agentId)}/policy`
      );
      setPolicy(data);
      setActive(data.active);
      setBudgetEnabled(data.budget_limit !== null);
      setBudgetLimit(data.budget_limit?.toString() ?? "");
      setHoursEnabled(
        data.allowed_hours_start !== null && data.allowed_hours_end !== null
      );
      setHoursStart(data.allowed_hours_start?.toString() ?? "9");
      setHoursEnd(data.allowed_hours_end?.toString() ?? "17");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policy");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload: Partial<PolicyData> = {
        active,
        budget_limit: budgetEnabled ? parseFloat(budgetLimit) || null : null,
        allowed_hours_start: hoursEnabled ? parseInt(hoursStart, 10) : null,
        allowed_hours_end: hoursEnabled ? parseInt(hoursEnd, 10) : null,
      };

      const updated = await api.put<PolicyData>(
        `/api/agents/${encodeURIComponent(agentId)}/policy`,
        payload
      );
      setPolicy(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const newActive = !active;
    setActive(newActive);

    setSaving(true);
    try {
      const updated = await api.put<PolicyData>(
        `/api/agents/${encodeURIComponent(agentId)}/policy`,
        { active: newActive }
      );
      setPolicy(updated);
      setError(null);
    } catch (err) {
      setActive(!newActive); // Revert on error
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="animate-pulse text-gray-400">Loading policy...</div>
      </div>
    );
  }

  // Calculate timezone offset for display
  const tzOffset = new Date().getTimezoneOffset();
  const tzHours = Math.abs(Math.floor(tzOffset / 60));
  const tzMins = Math.abs(tzOffset % 60);
  const tzSign = tzOffset <= 0 ? "+" : "-";
  const tzString = `UTC${tzSign}${tzHours}${tzMins > 0 ? `:${tzMins.toString().padStart(2, "0")}` : ""}`;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-300">
        Agent Policy Settings
      </h2>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Active Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Agent Active</p>
          <p className="text-xs text-gray-400">
            When disabled, all requests will be blocked
          </p>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            active ? "bg-green-600" : "bg-gray-600"
          } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              active ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Budget Limit */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="budget-enabled"
            checked={budgetEnabled}
            onChange={(e) => setBudgetEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="budget-enabled"
            className="text-sm font-medium text-white"
          >
            Daily Budget Limit
          </label>
        </div>
        {budgetEnabled && (
          <div className="mt-3 ml-7">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                min="0"
                step="0.01"
                className="w-24 rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="10.00"
              />
              <span className="text-sm text-gray-400">per day</span>
            </div>
            {policy && (
              <p className="mt-2 text-xs text-gray-400">
                Today's spend:{" "}
                <span className="font-medium text-white">
                  {formatCost(policy.daily_spend)}
                </span>
                {policy.budget_limit !== null && (
                  <>
                    {" "}
                    / ${policy.budget_limit.toFixed(2)}
                    {policy.daily_spend >= policy.budget_limit && (
                      <span className="ml-2 text-red-400">(Limit reached)</span>
                    )}
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Allowed Hours */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="hours-enabled"
            checked={hoursEnabled}
            onChange={(e) => setHoursEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="hours-enabled"
            className="text-sm font-medium text-white"
          >
            Allowed Operating Hours
          </label>
        </div>
        {hoursEnabled && (
          <div className="mt-3 ml-7">
            <div className="flex items-center gap-2">
              <select
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span className="text-gray-400">to</span>
              <select
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Server timezone: {tzString}
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end border-t border-gray-700 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {saving ? "Saving..." : "Save Policy"}
        </button>
      </div>
    </div>
  );
}
