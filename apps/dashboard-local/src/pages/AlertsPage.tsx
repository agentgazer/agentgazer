import { useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import Pagination from "../components/Pagination";
import FilterDropdown from "../components/FilterDropdown";

/* ---------- Types ---------- */

type NotificationType = "webhook" | "email" | "telegram";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
}

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  message_template: string;
}

interface AlertRule {
  id: string;
  agent_id: string;
  rule_type: "agent_down" | "error_rate" | "budget";
  config: Record<string, number>;
  notification_type: NotificationType;
  webhook_url?: string;
  smtp_config?: SmtpConfig;
  telegram_config?: TelegramConfig;
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

interface AgentOption {
  agent_id: string;
}

interface AgentsResponse {
  agents: AgentOption[];
}

type Tab = "rules" | "history";

type RuleType = "agent_down" | "error_rate" | "budget";

interface FormState {
  agent_id: string;
  rule_type: RuleType;
  config: Record<string, number>;
  notification_type: NotificationType;
  webhook_url: string;
  smtp_config: SmtpConfig;
  telegram_config: TelegramConfig;
}

/* ---------- Helpers ---------- */

function configSummary(
  rule_type: string,
  config: Record<string, number>,
): string {
  switch (rule_type) {
    case "agent_down":
      return `Inactive > ${config.duration_minutes ?? "?"}min`;
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

function defaultSmtpConfig(): SmtpConfig {
  return {
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "",
    to: "",
  };
}

function defaultTelegramConfig(): TelegramConfig {
  return {
    bot_token: "",
    chat_id: "",
    message_template: "[From AgentGazer] Alert: {rule_type} - Agent: {agent_id} - {message}",
  };
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
  const label = RULE_TYPE_LABELS[type] ?? type.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}

function NotificationBadge({ type }: { type: NotificationType | undefined }) {
  const icons: Record<NotificationType, React.ReactNode> = {
    webhook: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
    email: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
    telegram: (
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  };

  const labels: Record<NotificationType, string> = {
    webhook: "webhook",
    email: "email",
    telegram: "telegram",
  };

  const notifType = type ?? "webhook";

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      {icons[notifType]}
      {labels[notifType]}
    </span>
  );
}

/* ---------- Constants ---------- */

const RULE_TYPE_OPTIONS = [
  { value: "agent_down", label: "Agent Inactive" },
  { value: "error_rate", label: "Error Rate" },
  { value: "budget", label: "Budget Exceeded" },
];

const RULE_TYPE_LABELS: Record<string, string> = {
  agent_down: "Agent Inactive",
  error_rate: "Error Rate",
  budget: "Budget Exceeded",
};

const NOTIFICATION_TYPE_OPTIONS = [
  { value: "webhook", label: "Webhook" },
  { value: "email", label: "Email (SMTP)" },
  { value: "telegram", label: "Telegram Bot" },
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
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      return {
        agent_id: initial.agent_id,
        rule_type: initial.rule_type,
        config: { ...initial.config },
        notification_type: initial.notification_type ?? "webhook",
        webhook_url: initial.webhook_url ?? "",
        smtp_config: initial.smtp_config ?? defaultSmtpConfig(),
        telegram_config: initial.telegram_config ?? defaultTelegramConfig(),
      };
    }
    return {
      agent_id: "",
      rule_type: "agent_down",
      config: defaultConfig("agent_down"),
      notification_type: "webhook",
      webhook_url: "",
      smtp_config: defaultSmtpConfig(),
      telegram_config: defaultTelegramConfig(),
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch agents for dropdown
  useEffect(() => {
    api.get<AgentsResponse>("/api/agents?limit=1000")
      .then((data) => {
        setAgents(data.agents);
        // Auto-select first agent if creating new and no agent selected
        if (!editId && !form.agent_id && data.agents.length > 0) {
          setForm((f) => ({ ...f, agent_id: data.agents[0].agent_id }));
        }
      })
      .catch(() => setAgents([]))
      .finally(() => setLoadingAgents(false));
  }, [editId, form.agent_id]);

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

  function handleSmtpChange(key: keyof SmtpConfig, value: string | number | boolean) {
    setForm((f) => ({
      ...f,
      smtp_config: { ...f.smtp_config, [key]: value },
    }));
  }

  function handleTelegramChange(key: keyof TelegramConfig, value: string) {
    setForm((f) => ({
      ...f,
      telegram_config: { ...f.telegram_config, [key]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      agent_id: form.agent_id,
      rule_type: form.rule_type,
      config: form.config,
      notification_type: form.notification_type,
    };

    // Add notification-specific config
    if (form.notification_type === "webhook") {
      body.webhook_url = form.webhook_url || undefined;
    } else if (form.notification_type === "email") {
      body.smtp_config = form.smtp_config;
    } else if (form.notification_type === "telegram") {
      body.telegram_config = form.telegram_config;
    }

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

  const inputClass = "mt-1 block w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

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
        {/* Agent ID dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-400">
            Agent
          </label>
          {loadingAgents ? (
            <div className="mt-1 text-sm text-gray-500">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="mt-1">
              <input
                type="text"
                value={form.agent_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, agent_id: e.target.value }))
                }
                className={inputClass}
                placeholder="my-agent"
                required
              />
              <p className="mt-1 text-xs text-gray-500">No agents found. Enter agent ID manually.</p>
            </div>
          ) : (
            <select
              value={form.agent_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, agent_id: e.target.value }))
              }
              className={inputClass}
              required
            >
              <option value="">Select an agent...</option>
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.agent_id}
                </option>
              ))}
            </select>
          )}
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
            className={inputClass}
          >
            <option value="agent_down">Agent Inactive (no activity for X minutes)</option>
            <option value="error_rate">Error Rate (% errors in time window)</option>
            <option value="budget">Budget Exceeded (daily spend threshold)</option>
          </select>
        </div>
      </div>

      {/* Dynamic config fields */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {form.rule_type === "agent_down" && (
          <div>
            <label className="block text-xs font-medium text-gray-400">
              Inactive Duration (minutes)
            </label>
            <input
              type="number"
              min={1}
              value={form.config.duration_minutes ?? 5}
              onChange={(e) =>
                handleConfigChange("duration_minutes", e.target.value)
              }
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Alert when agent has no activity for this many minutes
            </p>
          </div>
        )}
        {form.rule_type === "error_rate" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-400">
                Error Threshold (%)
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
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">
                Time Window (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={form.config.window_minutes ?? 15}
                onChange={(e) =>
                  handleConfigChange("window_minutes", e.target.value)
                }
                className={inputClass}
              />
            </div>
          </>
        )}
        {form.rule_type === "budget" && (
          <div>
            <label className="block text-xs font-medium text-gray-400">
              Daily Budget Threshold (USD)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.config.threshold ?? 100}
              onChange={(e) =>
                handleConfigChange("threshold", e.target.value)
              }
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Alert when daily spend exceeds this amount
            </p>
          </div>
        )}
      </div>

      {/* Notification Type */}
      <div className="mt-6 border-t border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-white">Notification Settings</h4>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-400">
            Notification Method
          </label>
          <select
            value={form.notification_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, notification_type: e.target.value as NotificationType }))
            }
            className={inputClass}
          >
            {NOTIFICATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Webhook Config */}
      {form.notification_type === "webhook" && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">
              Webhook URL
            </label>
            <input
              type="url"
              value={form.webhook_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, webhook_url: e.target.value }))
              }
              className={inputClass}
              placeholder="https://hooks.example.com/webhook"
              required
            />
          </div>
          <div className="rounded-md bg-gray-900 p-3">
            <p className="text-xs font-medium text-gray-400">Webhook Payload Format</p>
            <pre className="mt-2 overflow-x-auto text-xs text-gray-300">
{`POST <your-webhook-url>
Content-Type: application/json

{
  "agent_id": "my-agent",
  "rule_type": "agent_down",
  "message": "Agent \\"my-agent\\" last heartbeat was 10 minutes ago",
  "timestamp": "2026-02-06T12:00:00.000Z"
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Email (SMTP) Config */}
      {form.notification_type === "email" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-400">SMTP Host</label>
              <input
                type="text"
                value={form.smtp_config.host}
                onChange={(e) => handleSmtpChange("host", e.target.value)}
                className={inputClass}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">SMTP Port</label>
              <input
                type="number"
                value={form.smtp_config.port}
                onChange={(e) => handleSmtpChange("port", parseInt(e.target.value) || 587)}
                className={inputClass}
                placeholder="587"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">SMTP User</label>
              <input
                type="text"
                value={form.smtp_config.user}
                onChange={(e) => handleSmtpChange("user", e.target.value)}
                className={inputClass}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">SMTP Password</label>
              <input
                type="password"
                value={form.smtp_config.pass}
                onChange={(e) => handleSmtpChange("pass", e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">From Address</label>
              <input
                type="email"
                value={form.smtp_config.from}
                onChange={(e) => handleSmtpChange("from", e.target.value)}
                className={inputClass}
                placeholder="alerts@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">To Address</label>
              <input
                type="email"
                value={form.smtp_config.to}
                onChange={(e) => handleSmtpChange("to", e.target.value)}
                className={inputClass}
                placeholder="admin@example.com"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtp-secure"
              checked={form.smtp_config.secure}
              onChange={(e) => handleSmtpChange("secure", e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="smtp-secure" className="text-xs text-gray-400">
              Use TLS/SSL (secure connection)
            </label>
          </div>
        </div>
      )}

      {/* Telegram Config */}
      {form.notification_type === "telegram" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-400">Bot Token</label>
              <input
                type="password"
                value={form.telegram_config.bot_token}
                onChange={(e) => handleTelegramChange("bot_token", e.target.value)}
                className={inputClass}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Get from @BotFather on Telegram
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">Chat ID</label>
              <input
                type="text"
                value={form.telegram_config.chat_id}
                onChange={(e) => handleTelegramChange("chat_id", e.target.value)}
                className={inputClass}
                placeholder="-1001234567890"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                User ID, group ID, or channel ID
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Message Template</label>
            <textarea
              value={form.telegram_config.message_template}
              onChange={(e) => handleTelegramChange("message_template", e.target.value)}
              className={inputClass + " h-20 resize-none"}
              placeholder="[From AgentGazer] Alert: {rule_type} - Agent: {agent_id} - {message}"
            />
            <p className="mt-1 text-xs text-gray-500">
              Available variables: {"{agent_id}"}, {"{rule_type}"}, {"{message}"}, {"{timestamp}"}
            </p>
          </div>
        </div>
      )}

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

  const [actionError, setActionError] = useState<string | null>(null);

  /* Handlers */
  async function handleToggle(rule: AlertRule) {
    setActionError(null);
    try {
      await api.patch(`/api/alerts/${rule.id}/toggle`, { enabled: !rule.enabled });
      refreshRules();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to toggle rule");
    }
  }

  async function handleDelete(rule: AlertRule) {
    if (!confirm(`Delete alert rule for "${rule.agent_id}"?`)) return;
    setActionError(null);
    try {
      await api.del(`/api/alerts/${rule.id}`);
      refreshRules();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete rule");
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
          {actionError && <ErrorBanner message={actionError} />}

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

                      {/* Notification type indicator */}
                      <NotificationBadge type={rule.notification_type} />
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
