"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import AlertForm from "./alert-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AlertRule {
  id: string;
  agent_id: string;
  rule_type: "agent_down" | "error_rate" | "budget";
  config: Record<string, unknown>;
  enabled: boolean;
  webhook_url: string | null;
  email: string | null;
  created_at: string;
}

interface AlertHistoryEntry {
  id: string;
  agent_id: string;
  rule_type: string;
  message: string;
  delivered_via: string;
  delivered_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const RULE_TYPE_LABELS: Record<string, string> = {
  agent_down: "Agent Down",
  error_rate: "Error Rate",
  budget: "Budget",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function configSummary(
  ruleType: string,
  config: Record<string, unknown>
): string {
  switch (ruleType) {
    case "agent_down": {
      const mins = config.duration_minutes ?? 10;
      return `Down for ${mins}m`;
    }
    case "error_rate": {
      const pct = config.threshold ?? 20;
      const win = config.window_minutes ?? 5;
      return `>${pct}% errors in ${win}m`;
    }
    case "budget": {
      const amt = config.threshold ?? 50;
      return `>$${amt}/day`;
    }
    default:
      return JSON.stringify(config);
  }
}

// ---------------------------------------------------------------------------
// Toggle switch component
// ---------------------------------------------------------------------------
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-blue-600" : "bg-gray-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // -----------------------------------------------------------------------
  // Fetch rules
  // -----------------------------------------------------------------------
  const fetchRules = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("alert_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRules(data ?? []);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch history
  // -----------------------------------------------------------------------
  const fetchHistory = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("alert_history")
      .select("*")
      .order("delivered_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setHistory(data ?? []);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Initial load
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchRules(), fetchHistory()]);
      setLoading(false);
    }
    load();
  }, [fetchRules, fetchHistory]);

  // -----------------------------------------------------------------------
  // Toggle rule enabled/disabled
  // -----------------------------------------------------------------------
  async function handleToggle(ruleId: string, enabled: boolean) {
    setTogglingId(ruleId);
    const { error: updateError } = await supabase
      .from("alert_rules")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", ruleId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
      );
    }
    setTogglingId(null);
  }

  // -----------------------------------------------------------------------
  // Delete rule
  // -----------------------------------------------------------------------
  async function handleDelete(ruleId: string) {
    const { error: deleteError } = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", ruleId);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
  }

  // -----------------------------------------------------------------------
  // After form save
  // -----------------------------------------------------------------------
  function handleFormSaved() {
    setShowForm(false);
    setEditingRule(null);
    fetchRules();
  }

  function handleEdit(rule: AlertRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (showForm) {
    return (
      <AlertForm
        onSaved={handleFormSaved}
        onCancel={() => {
          setShowForm(false);
          setEditingRule(null);
        }}
        editRule={
          editingRule
            ? {
                id: editingRule.id,
                agent_id: editingRule.agent_id,
                rule_type: editingRule.rule_type,
                config: editingRule.config,
                webhook_url: editingRule.webhook_url,
                email: editingRule.email,
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          New Alert Rule
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-400 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "rules"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Rules
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          History
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-gray-400">
          Loading...
        </div>
      )}

      {/* Rules tab */}
      {!loading && activeTab === "rules" && (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
              <p className="text-gray-400">No alert rules configured yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-sm text-blue-400 hover:text-blue-300"
              >
                Create your first alert rule
              </button>
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-5 py-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Toggle
                    checked={rule.enabled}
                    onChange={(val) => handleToggle(rule.id, val)}
                    disabled={togglingId === rule.id}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
                        {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                      </span>
                      <span className="truncate text-sm font-medium text-white">
                        {rule.agent_id}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                      <span>{configSummary(rule.rule_type, rule.config)}</span>
                      {rule.webhook_url && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Webhook
                        </span>
                      )}
                      {rule.email && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          Email
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex shrink-0 gap-2">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-950 hover:text-blue-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {!loading && activeTab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
              <p className="text-gray-400">No alerts have been fired yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Delivered Via</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {history.map((entry) => (
                    <tr key={entry.id} className="bg-gray-900 hover:bg-gray-800">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                        {formatTimestamp(entry.delivered_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                        {entry.agent_id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
                          {RULE_TYPE_LABELS[entry.rule_type] ?? entry.rule_type}
                        </span>
                      </td>
                      <td className="max-w-md truncate px-4 py-3 text-gray-300">
                        {entry.message}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.delivered_via === "webhook"
                              ? "bg-green-950 text-green-400"
                              : "bg-blue-950 text-blue-400"
                          }`}
                        >
                          {entry.delivered_via}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
