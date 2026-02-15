import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import CopyButton from "../components/CopyButton";

/* ---------- Types ---------- */

interface PromptInjectionRules {
  ignore_instructions: boolean;
  system_override: boolean;
  role_hijacking: boolean;
  jailbreak: boolean;
}

interface DataMaskingRules {
  api_keys: boolean;
  credit_cards: boolean;
  personal_data: boolean;
  crypto: boolean;
  env_vars: boolean;
  hardware_fingerprint: boolean;
}

interface ToolRestrictionsRules {
  max_per_request: number | null;
  max_per_minute: number | null;
  block_filesystem: boolean;
  block_network: boolean;
  block_code_execution: boolean;
}

interface CustomPattern {
  name: string;
  pattern: string;
}

interface SecurityConfig {
  agent_id: string | null;
  prompt_injection: {
    action: "log" | "alert" | "block";
    rules: PromptInjectionRules;
    custom: CustomPattern[];
  };
  data_masking: {
    replacement: string;
    rules: DataMaskingRules;
    custom: CustomPattern[];
  };
  tool_restrictions: {
    action: "log" | "alert" | "block";
    rules: ToolRestrictionsRules;
    allowlist: string[];
    blocklist: string[];
  };
}

interface SecurityEvent {
  id: string;
  agent_id: string;
  event_type: "prompt_injection" | "data_masked" | "tool_blocked" | "self_protection";
  severity: "info" | "warning" | "critical";
  action_taken: "logged" | "alerted" | "blocked" | "masked";
  rule_name: string | null;
  matched_pattern: string | null;
  snippet: string | null;
  request_id: string | null;
  request_body: string | null;
  created_at: string;
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

interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
}

interface AgentOption {
  agent_id: string;
}

interface AgentsResponse {
  agents: AgentOption[];
}

type Tab = "config" | "events";

/* ---------- Tooltip Keys ---------- */

// Maps rule keys to their i18n tooltip keys and docs anchors
const TOOLTIP_KEYS: Record<string, { i18nKey: string; docsAnchor: string }> = {
  // Prompt Injection
  ignore_instructions: { i18nKey: "security.tooltips.ignoreInstructions", docsAnchor: "#ignore-instructions" },
  system_override: { i18nKey: "security.tooltips.systemOverride", docsAnchor: "#system-override" },
  role_hijacking: { i18nKey: "security.tooltips.roleHijacking", docsAnchor: "#role-hijacking" },
  jailbreak: { i18nKey: "security.tooltips.jailbreak", docsAnchor: "#jailbreak" },
  // Data Masking - no tooltips needed, simple labels
  // Tool Restrictions - no tooltips needed, simple labels
};

/* ---------- Component ---------- */

export default function SecurityPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("config");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null); // null = ALL
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Payload modal
  const [selectedPayload, setSelectedPayload] = useState<PayloadData | null>(null);
  const [selectedSecurityEvent, setSelectedSecurityEvent] = useState<SecurityEvent | null>(null);
  const [payloadLoading, setPayloadLoading] = useState<string | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  // Load agents list
  useEffect(() => {
    api
      .get<AgentsResponse>("/api/agents")
      .then((res) => setAgents(res.agents || []))
      .catch(() => setAgents([]));
  }, []);

  // Load config when agent changes
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedAgent ? `?agent_id=${selectedAgent}` : "";
      const data = await api.get<SecurityConfig>(`/api/security/config${params}`);
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  // Load events
  const loadEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAgent) params.set("agent_id", selectedAgent);
      if (eventTypeFilter !== "all") params.set("event_type", eventTypeFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      params.set("limit", "50");

      const data = await api.get<SecurityEventsResponse>(
        `/api/security/events?${params.toString()}`
      );
      setEvents(data.events || []);
      setEventsTotal(data.total || 0);
    } catch {
      setEvents([]);
      setEventsTotal(0);
    }
  }, [selectedAgent, eventTypeFilter, severityFilter]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (tab === "events") {
      loadEvents();
    }
  }, [tab, loadEvents]);

  // Save config - accepts config to save (for auto-save after state update)
  const saveConfig = async (configToSave?: SecurityConfig) => {
    const data = configToSave ?? config;
    if (!data) return;
    console.log("[SecurityPage] saveConfig called", data);
    setSaving(true);
    setError(null);
    try {
      await api.put<SecurityConfig>("/api/security/config", data);
      console.log("[SecurityPage] saveConfig success");
    } catch (err) {
      console.error("[SecurityPage] saveConfig error", err);
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  // Load payload for security event
  const loadPayload = useCallback(async (event: SecurityEvent) => {
    // If the event has request_body directly, show it without API call
    if (event.request_body) {
      setSelectedSecurityEvent(event);
      setSelectedPayload(null);
      setPayloadError(null);
      return;
    }

    // Otherwise try to load from payloads API
    if (!event.request_id) {
      setPayloadError(t("security.payload.notFound"));
      return;
    }

    setPayloadLoading(event.request_id);
    setPayloadError(null);
    try {
      const payload = await api.get<PayloadData>(`/api/payloads/${event.request_id}`);
      setSelectedPayload(payload);
      setSelectedSecurityEvent(null);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setPayloadError(t("security.payload.notFound"));
      } else {
        setPayloadError(err instanceof Error ? err.message : "Failed to load payload");
      }
    } finally {
      setPayloadLoading(null);
    }
  }, [t]);

  // Toggle helpers with auto-save
  const togglePromptInjectionRule = (key: keyof PromptInjectionRules) => {
    if (!config) return;
    console.log("[SecurityPage] togglePromptInjectionRule", key);
    const newConfig = {
      ...config,
      prompt_injection: {
        ...config.prompt_injection,
        rules: {
          ...config.prompt_injection.rules,
          [key]: !config.prompt_injection.rules[key],
        },
      },
    };
    setConfig(newConfig);
    void saveConfig(newConfig);
  };

  const toggleDataMaskingRule = (key: keyof DataMaskingRules) => {
    if (!config) return;
    const newConfig = {
      ...config,
      data_masking: {
        ...config.data_masking,
        rules: {
          ...config.data_masking.rules,
          [key]: !config.data_masking.rules[key],
        },
      },
    };
    setConfig(newConfig);
    void saveConfig(newConfig);
  };

  const toggleToolRestrictionsRule = (key: keyof ToolRestrictionsRules) => {
    if (!config) return;
    const current = config.tool_restrictions.rules[key];
    const newValue = typeof current === "boolean" ? !current : current;
    const newConfig = {
      ...config,
      tool_restrictions: {
        ...config.tool_restrictions,
        rules: {
          ...config.tool_restrictions.rules,
          [key]: newValue,
        },
      },
    };
    setConfig(newConfig);
    void saveConfig(newConfig);
  };

  // Parent toggle state
  const getPromptInjectionToggleState = (): "on" | "off" | "partial" => {
    if (!config) return "off";
    const rules = config.prompt_injection.rules;
    const values = Object.values(rules);
    const allOn = values.every((v) => v);
    const allOff = values.every((v) => !v);
    return allOn ? "on" : allOff ? "off" : "partial";
  };

  const getDataMaskingToggleState = (): "on" | "off" | "partial" => {
    if (!config) return "off";
    const rules = config.data_masking.rules;
    const values = Object.values(rules);
    const allOn = values.every((v) => v);
    const allOff = values.every((v) => !v);
    return allOn ? "on" : allOff ? "off" : "partial";
  };

  const toggleAllPromptInjection = () => {
    if (!config) return;
    const state = getPromptInjectionToggleState();
    const newValue = state !== "on";
    const newConfig = {
      ...config,
      prompt_injection: {
        ...config.prompt_injection,
        rules: {
          ignore_instructions: newValue,
          system_override: newValue,
          role_hijacking: newValue,
          jailbreak: newValue,
        },
      },
    };
    setConfig(newConfig);
    void saveConfig(newConfig);
  };

  const toggleAllDataMasking = () => {
    if (!config) return;
    const state = getDataMaskingToggleState();
    const newValue = state !== "on";
    const newConfig = {
      ...config,
      data_masking: {
        ...config.data_masking,
        rules: {
          api_keys: newValue,
          credit_cards: newValue,
          personal_data: newValue,
          crypto: newValue,
          env_vars: newValue,
          hardware_fingerprint: newValue,
        },
      },
    };
    setConfig(newConfig);
    void saveConfig(newConfig);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("security.title")}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {t("security.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedAgent ?? "ALL"}
            onChange={(e) =>
              setSelectedAgent(e.target.value === "ALL" ? null : e.target.value)
            }
            className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="ALL">{t("security.allAgentsGlobal")}</option>
            {agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.agent_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setTab("config")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "config"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            {t("security.configuration")}
          </button>
          <button
            onClick={() => setTab("events")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "events"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            {t("security.securityEvents")}
          </button>
        </nav>
      </div>

      {tab === "config" && config && (
        <div className="space-y-6">
          {/* Self Protection - Always enabled */}
          <div className="rounded-lg border border-green-800 bg-green-950/30 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <h2 className="text-lg font-medium text-white">
                    {t("security.selfProtection.title")}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {t("security.selfProtection.subtitle")}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
                {t("security.selfProtection.alwaysEnabled")}
              </span>
            </div>
            <div className="mt-4 pl-10 space-y-2">
              <p className="text-sm text-gray-300">{t("security.selfProtection.description")}</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {t("security.selfProtection.configAccess")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {t("security.selfProtection.databaseAccess")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {t("security.selfProtection.secretsAccess")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {t("security.selfProtection.sqlInjection")}
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                {t("security.selfProtection.note")}
              </p>
            </div>
          </div>

          {/* Prompt Injection Detection */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h2 className="text-lg font-medium text-white">
                    {t("security.promptInjection.title")}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {t("security.promptInjection.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={config.prompt_injection.action}
                  onChange={(e) => {
                    const newConfig = {
                      ...config,
                      prompt_injection: {
                        ...config.prompt_injection,
                        action: e.target.value as "log" | "alert" | "block",
                      },
                    };
                    setConfig(newConfig);
                    void saveConfig(newConfig);
                  }}
                  className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
                >
                  <option value="log">{t("security.actions.log")}</option>
                  <option value="alert">{t("security.actions.alert")}</option>
                  <option value="block">{t("security.actions.block")}</option>
                </select>
                <ParentToggle
                  state={getPromptInjectionToggleState()}
                  onClick={toggleAllPromptInjection}
                />
              </div>
            </div>
            <div className="mt-4 space-y-3 pl-10">
              <ToggleRow
                label={t("security.promptInjection.ignoreInstructions")}
                checked={config.prompt_injection.rules.ignore_instructions}
                onChange={() => togglePromptInjectionRule("ignore_instructions")}
                tooltipKey="ignore_instructions"
              />
              <ToggleRow
                label={t("security.promptInjection.systemOverride")}
                checked={config.prompt_injection.rules.system_override}
                onChange={() => togglePromptInjectionRule("system_override")}
                tooltipKey="system_override"
              />
              <ToggleRow
                label={t("security.promptInjection.roleHijacking")}
                checked={config.prompt_injection.rules.role_hijacking}
                onChange={() => togglePromptInjectionRule("role_hijacking")}
                tooltipKey="role_hijacking"
                warning={t("security.promptInjection.openclawWarning")}
              />
              <ToggleRow
                label={t("security.promptInjection.jailbreak")}
                checked={config.prompt_injection.rules.jailbreak}
                onChange={() => togglePromptInjectionRule("jailbreak")}
                tooltipKey="jailbreak"
              />
              <CustomPatternEditor
                patterns={config.prompt_injection.custom}
                onChange={(patterns) => {
                  const newConfig = {
                    ...config,
                    prompt_injection: {
                      ...config.prompt_injection,
                      custom: patterns,
                    },
                  };
                  setConfig(newConfig);
                  void saveConfig(newConfig);
                }}
                title={t("security.customPatterns.title")}
              />
            </div>
          </div>

          {/* Sensitive Data Masking */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <h2 className="text-lg font-medium text-white">
                    {t("security.dataMasking.title")}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {t("security.dataMasking.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={config.data_masking.replacement}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        data_masking: {
                          ...config.data_masking,
                          replacement: e.target.value,
                        },
                      })
                    }
                    placeholder="[REDACTED]"
                    className="w-32 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => void saveConfig()}
                    disabled={saving}
                    className="rounded-md bg-gray-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                <ParentToggle
                  state={getDataMaskingToggleState()}
                  onClick={toggleAllDataMasking}
                />
              </div>
            </div>
            <div className="mt-4 space-y-3 pl-10">
              <ToggleRow
                label={t("security.dataMasking.apiKeys")}
                checked={config.data_masking.rules.api_keys}
                onChange={() => toggleDataMaskingRule("api_keys")}
              />
              <ToggleRow
                label={t("security.dataMasking.creditCards")}
                checked={config.data_masking.rules.credit_cards}
                onChange={() => toggleDataMaskingRule("credit_cards")}
              />
              <ToggleRow
                label={t("security.dataMasking.personalData")}
                checked={config.data_masking.rules.personal_data}
                onChange={() => toggleDataMaskingRule("personal_data")}
              />
              <ToggleRow
                label={t("security.dataMasking.cryptoWallets")}
                checked={config.data_masking.rules.crypto}
                onChange={() => toggleDataMaskingRule("crypto")}
              />
              <ToggleRow
                label={t("security.dataMasking.envVars")}
                checked={config.data_masking.rules.env_vars}
                onChange={() => toggleDataMaskingRule("env_vars")}
              />
              <ToggleRow
                label={t("security.dataMasking.hardwareFingerprint")}
                checked={config.data_masking.rules.hardware_fingerprint}
                onChange={() => toggleDataMaskingRule("hardware_fingerprint")}
              />
              <CustomPatternEditor
                patterns={config.data_masking.custom}
                onChange={(patterns) => {
                  const newConfig = {
                    ...config,
                    data_masking: {
                      ...config.data_masking,
                      custom: patterns,
                    },
                  };
                  setConfig(newConfig);
                  void saveConfig(newConfig);
                }}
                title={t("security.customPatterns.maskingTitle")}
              />
            </div>
          </div>

          {/* Tool Call Restrictions */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔧</span>
                <div>
                  <h2 className="text-lg font-medium text-white">
                    {t("security.toolRestrictions.title")}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {t("security.toolRestrictions.subtitle")}
                  </p>
                </div>
              </div>
              <select
                value={config.tool_restrictions.action}
                onChange={(e) => {
                  const newConfig = {
                    ...config,
                    tool_restrictions: {
                      ...config.tool_restrictions,
                      action: e.target.value as "log" | "alert" | "block",
                    },
                  };
                  setConfig(newConfig);
                  void saveConfig(newConfig);
                }}
                className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
              >
                <option value="log">{t("security.actions.log")}</option>
                <option value="alert">{t("security.actions.alert")}</option>
                <option value="block">{t("security.actions.block")}</option>
              </select>
            </div>
            <div className="mt-4 space-y-3 pl-10">
              <ToggleRow
                label={t("security.toolRestrictions.blockFilesystem")}
                checked={config.tool_restrictions.rules.block_filesystem}
                onChange={() => toggleToolRestrictionsRule("block_filesystem")}
              />
              <ToggleRow
                label={t("security.toolRestrictions.blockNetwork")}
                checked={config.tool_restrictions.rules.block_network}
                onChange={() => toggleToolRestrictionsRule("block_network")}
              />
              <ToggleRow
                label={t("security.toolRestrictions.blockCodeExecution")}
                checked={config.tool_restrictions.rules.block_code_execution}
                onChange={() => toggleToolRestrictionsRule("block_code_execution")}
              />
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-300">{t("security.toolRestrictions.maxPerRequest")}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={config.tool_restrictions.rules.max_per_request ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        tool_restrictions: {
                          ...config.tool_restrictions,
                          rules: {
                            ...config.tool_restrictions.rules,
                            max_per_request: e.target.value ? parseInt(e.target.value) : null,
                          },
                        },
                      })
                    }
                    placeholder={t("security.toolRestrictions.noLimit")}
                    className="w-24 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => void saveConfig()}
                    disabled={saving}
                    className="rounded-md bg-gray-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-300">{t("security.toolRestrictions.maxPerMinute")}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={config.tool_restrictions.rules.max_per_minute ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        tool_restrictions: {
                          ...config.tool_restrictions,
                          rules: {
                            ...config.tool_restrictions.rules,
                            max_per_minute: e.target.value ? parseInt(e.target.value) : null,
                          },
                        },
                      })
                    }
                    placeholder={t("security.toolRestrictions.noLimit")}
                    className="w-24 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => void saveConfig()}
                    disabled={saving}
                    className="rounded-md bg-gray-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </div>
              <StringListEditor
                items={config.tool_restrictions.allowlist}
                onChange={(items) => {
                  const newConfig = {
                    ...config,
                    tool_restrictions: {
                      ...config.tool_restrictions,
                      allowlist: items,
                    },
                  };
                  setConfig(newConfig);
                  void saveConfig(newConfig);
                }}
                title={t("security.toolRestrictions.allowlist")}
                placeholder="tool_name"
              />
              <StringListEditor
                items={config.tool_restrictions.blocklist}
                onChange={(items) => {
                  const newConfig = {
                    ...config,
                    tool_restrictions: {
                      ...config.tool_restrictions,
                      blocklist: items,
                    },
                  };
                  setConfig(newConfig);
                  void saveConfig(newConfig);
                }}
                title={t("security.toolRestrictions.blocklist")}
                placeholder="tool_name"
              />
            </div>
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
            >
              <option value="all">{t("common.allTypes")}</option>
              <option value="prompt_injection">{t("security.events.promptInjection")}</option>
              <option value="data_masked">{t("security.events.dataMasked")}</option>
              <option value="tool_blocked">{t("security.events.toolBlocked")}</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
            >
              <option value="all">{t("common.allSeverities")}</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <button
              onClick={loadEvents}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700"
            >
              {t("common.refresh")}
            </button>
          </div>

          {/* Events Table */}
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t("security.events.time")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t("security.events.agent")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t("security.events.type")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t("security.events.severity")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t("security.events.action")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t("security.events.rule")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-400">
                    {t("security.events.payload")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      {t("security.events.noEvents")}
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-900">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">
                        {relativeTime(event.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-white">
                        {event.agent_id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <EventTypeBadge type={event.event_type} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <SeverityBadge severity={event.severity} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">
                        {event.action_taken}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">
                        {event.rule_name || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {(event.request_body || event.request_id) ? (
                          <button
                            onClick={() => loadPayload(event)}
                            disabled={payloadLoading === event.request_id}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-indigo-300 disabled:opacity-50"
                            title={t("security.events.viewPayload")}
                          >
                            {payloadLoading === event.request_id ? (
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-500">
            {t("security.events.showingOf", { count: events.length, total: eventsTotal })}
          </div>
        </div>
      )}

      {/* Payload Modal */}
      {(selectedPayload || selectedSecurityEvent || payloadError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            setSelectedPayload(null);
            setSelectedSecurityEvent(null);
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
                {payloadError ? t("security.payload.error") : t("security.payload.title")}
              </h3>
              <button
                onClick={() => {
                  setSelectedPayload(null);
                  setSelectedSecurityEvent(null);
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
              ) : selectedSecurityEvent ? (
                <div className="space-y-4">
                  {/* Security event info */}
                  <div className="text-xs text-gray-500">
                    {t("security.events.agent")}: {selectedSecurityEvent.agent_id} | {t("security.events.type")}: {selectedSecurityEvent.event_type} | {selectedSecurityEvent.created_at}
                  </div>

                  {/* Matched info */}
                  {(selectedSecurityEvent.rule_name || selectedSecurityEvent.matched_pattern) && (
                    <div className="rounded bg-yellow-900/30 px-3 py-2 text-xs">
                      {selectedSecurityEvent.rule_name && (
                        <div className="text-yellow-300">
                          <span className="font-medium">{t("security.events.rule")}:</span> {selectedSecurityEvent.rule_name}
                        </div>
                      )}
                      {selectedSecurityEvent.matched_pattern && (
                        <div className="text-yellow-400 font-mono mt-1">
                          <span className="font-medium font-sans">{t("security.events.pattern")}:</span> {selectedSecurityEvent.matched_pattern}
                        </div>
                      )}
                      {selectedSecurityEvent.snippet && (
                        <div className="text-yellow-200 mt-1">
                          <span className="font-medium">{t("security.events.snippet")}:</span> {selectedSecurityEvent.snippet}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Request Body */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase text-gray-400">
                        {t("security.payload.request")}
                        {selectedSecurityEvent.request_body && (
                          <span className="ml-2 font-normal normal-case text-gray-500">
                            ({selectedSecurityEvent.request_body.length.toLocaleString()} {t("security.payload.chars")})
                          </span>
                        )}
                      </h4>
                      {selectedSecurityEvent.request_body && (
                        <CopyButton text={formatJSON(selectedSecurityEvent.request_body)} />
                      )}
                    </div>
                    <pre className="max-h-96 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                      {selectedSecurityEvent.request_body
                        ? formatJSON(selectedSecurityEvent.request_body)
                        : t("security.payload.noRequestBody")}
                    </pre>
                  </div>

                  {/* Note about blocked requests */}
                  {selectedSecurityEvent.action_taken === "blocked" && (
                    <div className="rounded bg-gray-900 px-3 py-2 text-xs text-gray-500">
                      {t("security.payload.blockedNote")}
                    </div>
                  )}
                </div>
              ) : selectedPayload && (
                <div className="space-y-4">
                  {/* Meta info */}
                  <div className="text-xs text-gray-500">
                    {t("security.payload.eventId")}: {selectedPayload.event_id} | {t("security.payload.size")}: {(selectedPayload.size_bytes / 1024).toFixed(1)} KB | {selectedPayload.created_at}
                  </div>

                  {/* Request */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase text-gray-400">
                        {t("security.payload.request")}
                        {selectedPayload.request_body && (
                          <span className="ml-2 font-normal normal-case text-gray-500">
                            ({selectedPayload.request_body.length.toLocaleString()} {t("security.payload.chars")})
                          </span>
                        )}
                      </h4>
                      {selectedPayload.request_body && (
                        <CopyButton text={formatJSON(selectedPayload.request_body)} />
                      )}
                    </div>
                    <pre className="max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                      {selectedPayload.request_body
                        ? formatJSON(selectedPayload.request_body)
                        : t("security.payload.noRequestBody")}
                    </pre>
                  </div>

                  {/* Response */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase text-gray-400">
                        {t("security.payload.response")}
                        {selectedPayload.response_body && (
                          <span className="ml-2 font-normal normal-case text-gray-500">
                            ({selectedPayload.response_body.length.toLocaleString()} {t("security.payload.chars")})
                          </span>
                        )}
                      </h4>
                      {selectedPayload.response_body && (
                        <CopyButton text={formatJSON(selectedPayload.response_body)} />
                      )}
                    </div>
                    <pre className="max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                      {selectedPayload.response_body
                        ? formatJSON(selectedPayload.response_body)
                        : t("security.payload.noResponseBody")}
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

/* ---------- Helper ---------- */

function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

/* ---------- Sub-components ---------- */

function ParentToggle({
  state,
  onClick,
}: {
  state: "on" | "off" | "partial";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        state === "on"
          ? "bg-blue-600"
          : state === "partial"
          ? "bg-blue-400"
          : "bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          state === "on"
            ? "translate-x-5"
            : state === "partial"
            ? "translate-x-2.5"
            : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function InfoTooltip({ tooltipKey, docsAnchor }: { tooltipKey: string; docsAnchor: string }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const title = t(`${tooltipKey}.title`);
  const description = t(`${tooltipKey}.description`);
  const examples = t(`${tooltipKey}.examples`, { returnObjects: true }) as string[];
  const warning = t(`${tooltipKey}.warning`, { defaultValue: "" });

  // Use current language for docs URL
  const lang = i18n.language === "en" ? "en" : "zh";

  return (
    <span className="relative inline-block">
      <a
        href={`https://www.agentgazer.com/${lang}/guide/security${docsAnchor}`}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-gray-400 hover:bg-blue-600 hover:text-white"
        aria-label={title}
      >
        ?
      </a>
      {isOpen && (
        <div className="pointer-events-none absolute left-0 top-6 z-50 w-72 rounded-lg border border-gray-700 bg-gray-800 p-3 shadow-xl">
          <div className="text-sm font-medium text-white">{title}</div>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
          {examples && examples.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-gray-500">Examples:</div>
              <ul className="mt-1 space-y-0.5">
                {examples.map((ex, i) => (
                  <li key={i} className="text-xs text-gray-400">
                    <code className="rounded bg-gray-900 px-1 py-0.5 text-gray-300">{ex}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warning && (
            <div className="mt-2 rounded bg-orange-900/50 px-2 py-1 text-xs text-orange-300">
              {warning}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  tooltipKey,
  warning,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  tooltipKey?: string;
  warning?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-gray-800">
      <span className="flex items-center gap-2 text-sm text-gray-300">
        {label}
        {tooltipKey && TOOLTIP_KEYS[tooltipKey] && (
          <InfoTooltip tooltipKey={TOOLTIP_KEYS[tooltipKey].i18nKey} docsAnchor={TOOLTIP_KEYS[tooltipKey].docsAnchor} />
        )}
        {warning && <span className="text-xs text-orange-400">{warning}</span>}
      </span>
      <button
        onClick={onChange}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    prompt_injection: "bg-red-900 text-red-200",
    data_masked: "bg-blue-900 text-blue-200",
    tool_blocked: "bg-yellow-900 text-yellow-200",
  };
  const labelKeys: Record<string, string> = {
    prompt_injection: "security.events.promptInjection",
    data_masked: "security.events.dataMasked",
    tool_blocked: "security.events.toolBlocked",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[type] || "bg-gray-700 text-gray-300"
      }`}
    >
      {labelKeys[type] ? t(labelKeys[type]) : type}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-900 text-red-200",
    warning: "bg-yellow-900 text-yellow-200",
    info: "bg-gray-700 text-gray-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[severity] || "bg-gray-700 text-gray-300"
      }`}
    >
      {severity}
    </span>
  );
}

/* ---------- Custom Pattern Editor ---------- */

function CustomPatternEditor({
  patterns,
  onChange,
  title,
}: {
  patterns: CustomPattern[];
  onChange: (patterns: CustomPattern[]) => void;
  title: string;
}) {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validatePattern = (pattern: string): boolean => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  };

  const handleAdd = () => {
    setError(null);
    if (!newName.trim()) {
      setError(t("security.customPatterns.nameRequired"));
      return;
    }
    if (!newPattern.trim()) {
      setError(t("security.customPatterns.patternRequired"));
      return;
    }
    if (!validatePattern(newPattern)) {
      setError(t("security.customPatterns.invalidRegex"));
      return;
    }
    onChange([...patterns, { name: newName.trim(), pattern: newPattern.trim() }]);
    setNewName("");
    setNewPattern("");
    setIsAdding(false);
  };

  const handleSaveEdit = (index: number) => {
    setError(null);
    if (!newName.trim()) {
      setError(t("security.customPatterns.nameRequired"));
      return;
    }
    if (!newPattern.trim()) {
      setError(t("security.customPatterns.patternRequired"));
      return;
    }
    if (!validatePattern(newPattern)) {
      setError(t("security.customPatterns.invalidRegex"));
      return;
    }
    const updated = [...patterns];
    updated[index] = { name: newName.trim(), pattern: newPattern.trim() };
    onChange(updated);
    setEditingIndex(null);
    setNewName("");
    setNewPattern("");
  };

  const handleDelete = (index: number) => {
    onChange(patterns.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setNewName(patterns[index].name);
    setNewPattern(patterns[index].pattern);
    setIsAdding(false);
    setError(null);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingIndex(null);
    setNewName("");
    setNewPattern("");
    setError(null);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setNewName("");
    setNewPattern("");
    setError(null);
  };

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        {!isAdding && editingIndex === null && (
          <button
            onClick={startAdd}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {t("security.customPatterns.addPattern")}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Existing patterns */}
      <div className="space-y-2">
        {patterns.map((p, index) => (
          <div key={index}>
            {editingIndex === index ? (
              <div className="space-y-2 rounded-md bg-gray-800 p-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("security.customPatterns.patternName")}
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white"
                />
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder={t("security.customPatterns.regexPattern")}
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(index)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md bg-gray-800/50 px-3 py-2">
                <div className="overflow-hidden">
                  <span className="text-sm text-white">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-500 font-mono truncate">
                    {p.pattern}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(index)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new pattern form */}
      {isAdding && (
        <div className="mt-2 space-y-2 rounded-md bg-gray-800 p-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("security.customPatterns.patternName")}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white"
          />
          <input
            type="text"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder={t("security.customPatterns.regexPattern")}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              {t("security.customPatterns.add")}
            </button>
            <button
              onClick={cancelEdit}
              className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {patterns.length === 0 && !isAdding && (
        <p className="text-xs text-gray-500">{t("security.customPatterns.noPatterns")}</p>
      )}
    </div>
  );
}

/* ---------- String List Editor (for allowlist/blocklist) ---------- */

function StringListEditor({
  items,
  onChange,
  title,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  title: string;
  placeholder: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (!newItem.trim()) return;
    if (items.includes(newItem.trim())) {
      setNewItem("");
      setIsAdding(false);
      return;
    }
    onChange([...items, newItem.trim()]);
    setNewItem("");
    setIsAdding(false);
  };

  const handleDelete = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setNewItem("");
    }
  };

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            + Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"
          >
            {item}
            <button
              onClick={() => handleDelete(index)}
              className="ml-1 text-gray-500 hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}

        {isAdding && (
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (newItem.trim()) handleAdd();
              else setIsAdding(false);
            }}
            placeholder={placeholder}
            autoFocus
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white w-40"
          />
        )}
      </div>

      {items.length === 0 && !isAdding && (
        <p className="text-xs text-gray-500">No items configured</p>
      )}
    </div>
  );
}
