import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface KillSwitchConfig {
  enabled: boolean;
  window_size: number;
  threshold: number;
}

interface AlertRule {
  id: string;
  agent_id: string;
  rule_type: string;
  enabled: boolean;
}

interface KillSwitchSettingsProps {
  agentId: string;
}

export default function KillSwitchSettings({ agentId }: KillSwitchSettingsProps) {
  const [config, setConfig] = useState<KillSwitchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasAlertRule, setHasAlertRule] = useState(false);
  const [showNoAlertWarning, setShowNoAlertWarning] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [windowSize, setWindowSize] = useState(20);
  const [threshold, setThreshold] = useState(10);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get<KillSwitchConfig>(
        `/api/agents/${encodeURIComponent(agentId)}/kill-switch`
      );
      setConfig(data);
      setEnabled(data.enabled);
      setWindowSize(data.window_size);
      setThreshold(data.threshold);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load kill switch config");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const checkAlertRules = useCallback(async () => {
    try {
      const response = await api.get<{ alerts: AlertRule[] }>(
        `/api/alerts?agent_id=${encodeURIComponent(agentId)}&rule_type=kill_switch`
      );
      setHasAlertRule(response.alerts.some(r => r.enabled));
    } catch {
      // Ignore error - just means we can't check
    }
  }, [agentId]);

  useEffect(() => {
    fetchConfig();
    checkAlertRules();
  }, [fetchConfig, checkAlertRules]);

  const handleToggleEnabled = async () => {
    const newEnabled = !enabled;

    // If enabling and no alert rule, show warning
    if (newEnabled && !hasAlertRule) {
      setShowNoAlertWarning(true);
      return;
    }

    await saveConfig({ enabled: newEnabled });
  };

  const handleConfirmEnableWithoutAlert = async () => {
    setShowNoAlertWarning(false);
    await saveConfig({ enabled: true });
  };

  const saveConfig = async (updates: Partial<KillSwitchConfig>) => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        enabled: updates.enabled ?? enabled,
        window_size: updates.window_size ?? windowSize,
        threshold: updates.threshold ?? threshold,
      };

      const updated = await api.patch<KillSwitchConfig>(
        `/api/agents/${encodeURIComponent(agentId)}/kill-switch`,
        payload
      );
      setConfig(updated);
      setEnabled(updated.enabled);
      setWindowSize(updated.window_size);
      setThreshold(updated.threshold);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
      // Revert on error
      if (config) {
        setEnabled(config.enabled);
        setWindowSize(config.window_size);
        setThreshold(config.threshold);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await saveConfig({
      enabled,
      window_size: windowSize,
      threshold,
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="animate-pulse text-gray-400">Loading kill switch settings...</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs">
          !
        </span>
        Kill Switch (Loop Detection)
      </h2>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Warning Modal */}
      {showNoAlertWarning && (
        <div className="mb-4 rounded-md border border-yellow-700 bg-yellow-900/20 p-4">
          <p className="text-sm font-medium text-yellow-400">No Alert Rule Configured</p>
          <p className="mt-1 text-xs text-yellow-300/80">
            The kill switch will block loops but you won't receive notifications.
            Consider adding a "kill_switch" alert rule on the Alerts page first.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleConfirmEnableWithoutAlert}
              className="rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500"
            >
              Enable Anyway
            </button>
            <button
              onClick={() => setShowNoAlertWarning(false)}
              className="rounded-md bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Description */}
      <p className="mb-4 text-xs text-gray-400">
        Automatically detect and block infinite loops to prevent wasting API credits.
        When triggered, requests return HTTP 429 and an alert is sent.
      </p>

      {/* Enable Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Kill Switch Enabled</p>
          <p className="text-xs text-gray-400">
            {enabled ? "Loop detection is active" : "Loop detection is disabled"}
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-red-600" : "bg-gray-600"
          } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Configuration (only show when enabled) */}
      {enabled && (
        <div className="space-y-4 border-t border-gray-700 pt-4">
          {/* Window Size */}
          <div>
            <label htmlFor="window-size" className="block text-sm font-medium text-white">
              Detection Window Size
            </label>
            <p className="text-xs text-gray-400">
              Number of recent requests to analyze for patterns (5-100)
            </p>
            <input
              type="number"
              id="window-size"
              value={windowSize}
              onChange={(e) => setWindowSize(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
              min={5}
              max={100}
              className="mt-2 w-24 rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Threshold */}
          <div>
            <label htmlFor="threshold" className="block text-sm font-medium text-white">
              Loop Score Threshold
            </label>
            <p className="text-xs text-gray-400">
              Minimum score to trigger kill switch (1-50). Lower = more sensitive.
            </p>
            <input
              type="number"
              id="threshold"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Math.min(50, parseFloat(e.target.value) || 10)))}
              min={1}
              max={50}
              step={0.5}
              className="mt-2 w-24 rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Scoring explanation */}
          <div className="rounded-md border border-gray-700 bg-gray-900 p-3">
            <p className="text-xs font-medium text-gray-300">How scoring works:</p>
            <ul className="mt-1 list-inside list-disc text-xs text-gray-400">
              <li>Similar prompts: +1.0 per match</li>
              <li>Similar responses: +2.0 per pair</li>
              <li>Repeated tool calls: +1.5 per match</li>
            </ul>
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
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Alert status indicator */}
      {enabled && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          {hasAlertRule ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="text-green-400">Alert rule configured</span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-yellow-400">No alert rule - loops will be blocked silently</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
