import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import Pagination from "../components/Pagination";
import FilterDropdown from "../components/FilterDropdown";

/* ---------- Types ---------- */

interface AlertRule {
  id: string;
  agent_id: string;
  rule_type: "agent_down" | "error_rate" | "budget";
  config: Record<string, number>;
  webhook_url?: string;
  enabled: boolean;
}

interface AlertsResponse {
  alerts: AlertRule[];
  total?: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  agent_id: string;
  rule_type: string;
  message: string;
  delivered_via: string;
}

interface HistoryResponse {
  history: HistoryEntry[];
  total?: number;
}

type Tab = "rules" | "history";

type RuleType = "agent_down" | "error_rate" | "budget";

interface FormState {
  agent_id: string;
  rule_type: RuleType;
  config: Record<string, number>;
  webhook_url: string;
}

/* ---------- Helpers ---------- */

function configSummary(
  rule_type: string,
  config: Record<string, number>,
): string {
  switch (rule_type) {
    case "agent_down":
      return `Down > ${config.duration_minutes ?? "?"}min`;
    case "error_rate":
      return `Errors > ${config.threshold ?? "?"}% / ${config.window_minutes ?? "?"}min`;
    case "budget":
      return `Cost > $${(config.threshold ?? 0).toFixed(2)}`;
    default:
      return JSON.stringify(config);
  }
}

function defaultConfig(ruleType: RuleType): Record<string, number> {
  switch (ruleType) {
    case "agent_down":
      return { duration_minutes: 5 };
    case "error_rate":
      return { threshold: 10, window_minutes: 15 };
    case "budget":
      return { threshold: 100 };
  }
}

/* ---------- Rule Type Badge ---------- */

const RULE_TYPE_STYLES: Record<string, string> = {
  agent_down: "bg-red-900/50 text-red-400 border-red-700",
  error_rate: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
  budget: "bg-blue-900/50 text-blue-400 border-blue-700",
};

function RuleTypeBadge({ type }: { type: string }) {
  const style =
    RULE_TYPE_STYLES[type] ?? "bg-gray-800 text-gray-400 border-gray-600";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {type.replace("_", " ")}
    </span>
  );
}

/* ---------- Constants ---------- */

const RULE_TYPE_OPTIONS = [
  { value: "agent_down", label: "agent_down" },
  { value: "error_rate", label: "error_rate" },
  { value: "budget", label: "budget" },
];

const RULES_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 20;

/* ---------- Alert Form ---------- */

function AlertForm({
  initial,
  editId,
  onSave,
  onCancel,
}: {
  initial?: AlertRule;
  editId?: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      return {
        agent_id: initial.agent_id,
        rule_type: initial.rule_type,
        config: { ...initial.config },
        webhook_url: initial.webhook_url ?? "",
      };
    }
    return {
      agent_id: "",
      rule_type: "agent_down",
      config: defaultConfig("agent_down"),
      webhook_url: "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRuleTypeChange(rt: RuleType) {
    setForm((f) => ({
      ...f,
      rule_type: rt,
      config: defaultConfig(rt),
    }));
  }

  function handleConfigChange(key: string, value: string) {
    const num = parseFloat(value);
    setForm((f) => ({
      ...f,
      config: { ...f.config, [key]: isNaN(num) ? 0 : num },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      agent_id: form.agent_id,
      rule_type: form.rule_type,
      config: form.config,
      webhook_url: form.webhook_url || undefined,
    };

    try {
      if (editId) {
        await api.put(`/api/alerts/${editId}`, body);
      } else {
        await api.post("/api/alerts", body);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-700 bg-gray-800 p-5"
    >
      <h3 className="text-sm font-semibold text-white">
        {editId ? "Edit Alert Rule" : "New Alert Rule"}
      </h3>

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Agent ID */}
        <div>
          <label className="block text-xs font-medium text-gray-400">
            Agent ID
          </label>
          <input
            type="text"
            value={form.agent_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, agent_id: e.target.value }))
            }
            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="my-agent"
            required
          />
        </div>

        {/* Rule type */}
        <div>
          <label className="block text-xs font-medium text-gray-400">
            Rule Type
          </label>
          <select
            value={form.rule_type}
            onChange={(e) =>
              handleRuleTypeChange(e.target.value as RuleType)
            }
            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="agent_down">agent_down</option>
            <option value="error_rate">error_rate</option>
            <option value="budget">budget</option>
          </select>
        </div>
      </div>

      {/* Dynamic config fields */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {form.rule_type === "agent_down" && (
          <div>
            <label className="block text-xs font-medium text-gray-400">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={1}
              value={form.config.duration_minutes ?? 5}
              onChange={(e) =>
                handleConfigChange("duration_minutes", e.target.value)
              }
              className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        {form.rule_type === "error_rate" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-400">
                Threshold (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.config.threshold ?? 10}
                onChange={(e) =>
                  handleConfigChange("threshold", e.target.value)
                }
                className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">
                Window (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={form.config.window_minutes ?? 15}
                onChange={(e) =>
                  handleConfigChange("window_minutes", e.target.value)
                }
                className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        {form.rule_type === "budget" && (
          <div>
            <label className="block text-xs font-medium text-gray-400">
              Budget Threshold (USD)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.config.threshold ?? 100}
              onChange={(e) =>
                handleConfigChange("threshold", e.target.value)
              }
              className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Webhook URL */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-400">
          Webhook URL
        </label>
        <input
          type="url"
          value={form.webhook_url}
          onChange={(e) =>
            setForm((f) => ({ ...f, webhook_url: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="https://hooks.example.com/webhook"
        />
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- Main Page ---------- */

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Rules pagination + filter
  const [rulesPage, setRulesPage] = useState(1);
  const [rulesTypeFilter, setRulesTypeFilter] = useState("");

  // History pagination + filter
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");

  /* Rules data */
  const rulesFetcher = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(RULES_PAGE_SIZE));
    params.set("offset", String((rulesPage - 1) * RULES_PAGE_SIZE));
    if (rulesTypeFilter) params.set("rule_type", rulesTypeFilter);
    return api.get<AlertsResponse>(`/api/alerts?${params.toString()}`);
  }, [rulesPage, rulesTypeFilter]);

  const {
    data: rulesData,
    error: rulesError,
    loading: rulesLoading,
    refresh: refreshRules,
  } = usePolling(rulesFetcher, 5000);

  /* History data */
  const historyFetcher = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(HISTORY_PAGE_SIZE));
    params.set("offset", String((historyPage - 1) * HISTORY_PAGE_SIZE));
    if (historyTypeFilter) params.set("rule_type", historyTypeFilter);
    return api.get<HistoryResponse>(`/api/alert-history?${params.toString()}`);
  }, [historyPage, historyTypeFilter]);

  const {
    data: historyData,
    error: historyError,
    loading: historyLoading,
  } = usePolling(historyFetcher, 5000);

  const rulesTotalPages =
    rulesData?.total != null ? Math.ceil(rulesData.total / RULES_PAGE_SIZE) : 1;
  const historyTotalPages =
    historyData?.total != null ? Math.ceil(historyData.total / HISTORY_PAGE_SIZE) : 1;

  /* Handlers */
  async function handleToggle(rule: AlertRule) {
    try {
      await api.patch(`/api/alerts/${rule.id}/toggle`, {});
      refreshRules();
    } catch {
      // silent: next poll will reflect state
    }
  }

  async function handleDelete(rule: AlertRule) {
    if (!confirm(`Delete alert rule for "${rule.agent_id}"?`)) return;
    try {
      await api.del(`/api/alerts/${rule.id}`);
      refreshRules();
    } catch {
      // silent
    }
  }

  function handleEdit(rule: AlertRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  function handleFormSave() {
    setShowForm(false);
    setEditingRule(null);
    refreshRules();
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingRule(null);
  }

  function handleRulesTypeChange(v: string) {
    setRulesTypeFilter(v);
    setRulesPage(1);
  }

  function handleHistoryTypeChange(v: string) {
    setHistoryTypeFilter(v);
    setHistoryPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Alerts</h1>

      {/* Tabs */}
      <div className="mt-6 flex border-b border-gray-700">
        <button
          onClick={() => setTab("rules")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "rules"
              ? "border-b-2 border-blue-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Rules
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "history"
              ? "border-b-2 border-blue-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          History
        </button>
      </div>

      {/* -------- Rules Tab -------- */}
      {tab === "rules" && (
        <div className="mt-6">
          {rulesError && <ErrorBanner message={rulesError} />}

          {/* New rule button + filter */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {!showForm && (
              <button
                onClick={() => {
                  setEditingRule(null);
                  setShowForm(true);
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                New Alert Rule
              </button>
            )}
            <FilterDropdown
              value={rulesTypeFilter}
              onChange={handleRulesTypeChange}
              options={RULE_TYPE_OPTIONS}
              label="Types"
            />
          </div>

          {/* Inline form */}
          {showForm && (
            <div className="mb-6">
              <AlertForm
                initial={editingRule ?? undefined}
                editId={editingRule?.id}
                onSave={handleFormSave}
                onCancel={handleFormCancel}
              />
            </div>
          )}

          {rulesLoading && !rulesData && <LoadingSpinner />}

          {rulesData && rulesData.alerts.length === 0 && !showForm && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
              <p className="text-gray-400">
                No alert rules configured. Create one to get started.
              </p>
            </div>
          )}

          {rulesData && rulesData.alerts.length > 0 && (
            <>
              <div className="space-y-3">
                {rulesData.alerts.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800 px-5 py-4"
                  >
                    {/* Left section */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium text-white">
                        {rule.agent_id}
                      </span>
                      <RuleTypeBadge type={rule.rule_type} />
                      <span className="text-xs text-gray-400">
                        {configSummary(rule.rule_type, rule.config)}
                      </span>

                      {/* Webhook indicator */}
                      {rule.webhook_url && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                            />
                          </svg>
                          webhook
                        </span>
                      )}
                    </div>

                    {/* Right section: actions */}
                    <div className="flex items-center gap-3">
                      {/* Toggle switch */}
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                          rule.enabled ? "bg-blue-600" : "bg-gray-600"
                        }`}
                        role="switch"
                        aria-checked={rule.enabled}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                            rule.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>

                      <button
                        onClick={() => handleEdit(rule)}
                        className="rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="rounded-md bg-red-900/50 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-800 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                currentPage={rulesPage}
                totalPages={rulesTotalPages}
                onPageChange={setRulesPage}
              />
            </>
          )}
        </div>
      )}

      {/* -------- History Tab -------- */}
      {tab === "history" && (
        <div className="mt-6">
          {historyError && <ErrorBanner message={historyError} />}

          {/* Filter */}
          <div className="mb-4">
            <FilterDropdown
              value={historyTypeFilter}
              onChange={handleHistoryTypeChange}
              options={RULE_TYPE_OPTIONS}
              label="Types"
            />
          </div>

          {historyLoading && !historyData && <LoadingSpinner />}

          {historyData && historyData.history.length === 0 && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
              <p className="text-gray-400">No alert history yet.</p>
            </div>
          )}

          {historyData && historyData.history.length > 0 && (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-700">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium">Agent</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Message</th>
                      <th className="px-4 py-3 font-medium">Delivered Via</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {historyData.history.map((entry) => (
                      <tr
                        key={entry.id}
                        className="bg-gray-900 transition-colors hover:bg-gray-800"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                          {relativeTime(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {entry.agent_id}
                        </td>
                        <td className="px-4 py-3">
                          <RuleTypeBadge type={entry.rule_type} />
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-gray-300">
                          {entry.message}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {entry.delivered_via}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
