import { useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

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
  event_type: "prompt_injection" | "data_masked" | "tool_blocked";
  severity: "info" | "warning" | "critical";
  action_taken: "logged" | "alerted" | "blocked" | "masked";
  rule_name: string | null;
  matched_pattern: string | null;
  snippet: string | null;
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

/* ---------- Tooltip Content ---------- */

const TOOLTIP_CONTENT: Record<string, TooltipData> = {
  // Prompt Injection
  ignore_instructions: {
    title: "Ignore Previous Instructions",
    description: "Detects attempts to make the AI ignore its original instructions or rules.",
    examples: ["ignore all previous instructions", "forget your rules", "disregard prior context"],
    docsAnchor: "#ignore-instructions",
  },
  system_override: {
    title: "System Prompt Override",
    description: "Detects attempts to override or replace the system prompt with new instructions.",
    examples: ["new system prompt:", "enable developer mode", "override system message"],
    docsAnchor: "#system-override",
  },
  role_hijacking: {
    title: "Role Hijacking",
    description: "Detects attempts to change the AI's role or identity to bypass restrictions.",
    examples: ["you are now a...", "pretend to be", "roleplay as"],
    docsAnchor: "#role-hijacking",
  },
  jailbreak: {
    title: "Jailbreak Patterns",
    description: "Detects known jailbreak techniques like DAN prompts and restriction bypasses.",
    examples: ["DAN mode", "bypass safety filters", "remove restrictions"],
    docsAnchor: "#jailbreak",
  },

  // Data Masking
  api_keys: {
    title: "API Keys",
    description: "Masks API keys from major providers to prevent accidental exposure.",
    examples: ["sk-...", "anthropic-...", "AIza..."],
    docsAnchor: "#api-keys",
  },
  credit_cards: {
    title: "Credit Card Numbers",
    description: "Masks credit card numbers in common formats (Visa, Mastercard, Amex, etc.).",
    examples: ["4111-1111-1111-1111", "5500 0000 0000 0004"],
    docsAnchor: "#credit-cards",
  },
  personal_data: {
    title: "Personal Data",
    description: "Masks personally identifiable information like SSN, email addresses, and phone numbers.",
    examples: ["123-45-6789", "user@email.com", "+1-555-123-4567"],
    docsAnchor: "#personal-data",
  },
  crypto: {
    title: "Crypto Wallets & Keys",
    description: "Masks cryptocurrency wallet addresses and private keys.",
    examples: ["0x742d35Cc...", "bc1q...", "5HueCG..."],
    docsAnchor: "#crypto",
  },
  env_vars: {
    title: "Environment Variables",
    description: "Masks environment variable patterns that may contain secrets.",
    examples: ["DATABASE_URL=...", "SECRET_KEY=...", "API_TOKEN=..."],
    docsAnchor: "#env-vars",
  },

  // Tool Restrictions
  block_filesystem: {
    title: "Block Filesystem Tools",
    description: "Blocks tools that read, write, or delete files on the filesystem.",
    examples: ["read_file", "write_file", "delete_file", "list_directory"],
    docsAnchor: "#filesystem",
  },
  block_network: {
    title: "Block Network Tools",
    description: "Blocks tools that make network requests or access external services.",
    examples: ["http_request", "fetch_url", "curl", "wget"],
    docsAnchor: "#network",
  },
  block_code_execution: {
    title: "Block Code Execution",
    description: "Blocks tools that execute arbitrary code or shell commands.",
    examples: ["execute_code", "run_command", "eval", "exec"],
    docsAnchor: "#code-execution",
  },
};

interface TooltipData {
  title: string;
  description: string;
  examples: string[];
  docsAnchor: string;
}

/* ---------- Component ---------- */

export default function SecurityPage() {
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
          <h1 className="text-2xl font-semibold text-white">Security</h1>
          <p className="mt-1 text-sm text-gray-400">
            Configure security rules for prompt injection detection, data masking, and tool restrictions
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
            <option value="ALL">All Agents (Global)</option>
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
            Configuration
          </button>
          <button
            onClick={() => setTab("events")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "events"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            Security Events
          </button>
        </nav>
      </div>

      {tab === "config" && config && (
        <div className="space-y-6">
          {/* Prompt Injection Detection */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h2 className="text-lg font-medium text-white">
                    Prompt Injection Detection
                  </h2>
                  <p className="text-sm text-gray-400">
                    Detect attempts to override system instructions
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
                  <option value="log">Log</option>
                  <option value="alert">Alert</option>
                  <option value="block">Block</option>
                </select>
                <ParentToggle
                  state={getPromptInjectionToggleState()}
                  onClick={toggleAllPromptInjection}
                />
              </div>
            </div>
            <div className="mt-4 space-y-3 pl-10">
              <ToggleRow
                label="Ignore previous instructions"
                checked={config.prompt_injection.rules.ignore_instructions}
                onChange={() => togglePromptInjectionRule("ignore_instructions")}
                tooltip={TOOLTIP_CONTENT.ignore_instructions}
              />
              <ToggleRow
                label="System prompt override"
                checked={config.prompt_injection.rules.system_override}
                onChange={() => togglePromptInjectionRule("system_override")}
                tooltip={TOOLTIP_CONTENT.system_override}
              />
              <ToggleRow
                label="Role hijacking"
                checked={config.prompt_injection.rules.role_hijacking}
                onChange={() => togglePromptInjectionRule("role_hijacking")}
                tooltip={TOOLTIP_CONTENT.role_hijacking}
              />
              <ToggleRow
                label="Jailbreak patterns"
                checked={config.prompt_injection.rules.jailbreak}
                onChange={() => togglePromptInjectionRule("jailbreak")}
                tooltip={TOOLTIP_CONTENT.jailbreak}
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
                title="Custom Detection Patterns"
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
                    Sensitive Data Masking
                  </h2>
                  <p className="text-sm text-gray-400">
                    Automatically mask sensitive data in requests and responses
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
                label="API Keys"
                checked={config.data_masking.rules.api_keys}
                onChange={() => toggleDataMaskingRule("api_keys")}
                tooltip={TOOLTIP_CONTENT.api_keys}
              />
              <ToggleRow
                label="Credit Card Numbers"
                checked={config.data_masking.rules.credit_cards}
                onChange={() => toggleDataMaskingRule("credit_cards")}
                tooltip={TOOLTIP_CONTENT.credit_cards}
              />
              <ToggleRow
                label="Personal Data (SSN, Email, Phone)"
                checked={config.data_masking.rules.personal_data}
                onChange={() => toggleDataMaskingRule("personal_data")}
                tooltip={TOOLTIP_CONTENT.personal_data}
              />
              <ToggleRow
                label="Crypto Wallets & Keys"
                checked={config.data_masking.rules.crypto}
                onChange={() => toggleDataMaskingRule("crypto")}
                tooltip={TOOLTIP_CONTENT.crypto}
              />
              <ToggleRow
                label="Environment Variables"
                checked={config.data_masking.rules.env_vars}
                onChange={() => toggleDataMaskingRule("env_vars")}
                tooltip={TOOLTIP_CONTENT.env_vars}
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
                title="Custom Masking Patterns"
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
                    Tool Call Restrictions
                  </h2>
                  <p className="text-sm text-gray-400">
                    Limit and control tool usage by agents
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
                <option value="log">Log</option>
                <option value="alert">Alert</option>
                <option value="block">Block</option>
              </select>
            </div>
            <div className="mt-4 space-y-3 pl-10">
              <ToggleRow
                label="Block filesystem tools"
                checked={config.tool_restrictions.rules.block_filesystem}
                onChange={() => toggleToolRestrictionsRule("block_filesystem")}
                tooltip={TOOLTIP_CONTENT.block_filesystem}
              />
              <ToggleRow
                label="Block network tools"
                checked={config.tool_restrictions.rules.block_network}
                onChange={() => toggleToolRestrictionsRule("block_network")}
                tooltip={TOOLTIP_CONTENT.block_network}
              />
              <ToggleRow
                label="Block code execution"
                checked={config.tool_restrictions.rules.block_code_execution}
                onChange={() => toggleToolRestrictionsRule("block_code_execution")}
                tooltip={TOOLTIP_CONTENT.block_code_execution}
              />
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-300">Max calls per request:</label>
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
                    placeholder="No limit"
                    className="w-24 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => void saveConfig()}
                    disabled={saving}
                    className="rounded-md bg-gray-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-300">Max calls per minute:</label>
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
                    placeholder="No limit"
                    className="w-24 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => void saveConfig()}
                    disabled={saving}
                    className="rounded-md bg-gray-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  >
                    Save
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
                title="Allowlist (only these tools allowed)"
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
                title="Blocklist (these tools blocked)"
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
              <option value="all">All Types</option>
              <option value="prompt_injection">Prompt Injection</option>
              <option value="data_masked">Data Masked</option>
              <option value="tool_blocked">Tool Blocked</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <button
              onClick={loadEvents}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>

          {/* Events Table */}
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Agent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Rule
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No security events found
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-500">
            Showing {events.length} of {eventsTotal} events
          </div>
        </div>
      )}
    </div>
  );
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

function InfoTooltip({ data }: { data: TooltipData }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <a
        href={`https://www.agentgazer.com/en/guide/security${data.docsAnchor}`}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-gray-400 hover:bg-blue-600 hover:text-white"
        aria-label={`Info about ${data.title} - click to view docs`}
      >
        ?
      </a>
      {isOpen && (
        <div className="pointer-events-none absolute left-0 top-6 z-50 w-72 rounded-lg border border-gray-700 bg-gray-800 p-3 shadow-xl">
          <div className="text-sm font-medium text-white">{data.title}</div>
          <p className="mt-1 text-xs text-gray-400">{data.description}</p>
          {data.examples.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-gray-500">Examples:</div>
              <ul className="mt-1 space-y-0.5">
                {data.examples.map((ex, i) => (
                  <li key={i} className="text-xs text-gray-400">
                    <code className="rounded bg-gray-900 px-1 py-0.5 text-gray-300">{ex}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2 text-xs text-blue-400">Click to view docs</div>
        </div>
      )}
    </span>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  tooltip?: TooltipData;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-gray-800">
      <span className="flex items-center gap-2 text-sm text-gray-300">
        {label}
        {tooltip && <InfoTooltip data={tooltip} />}
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
  const colors: Record<string, string> = {
    prompt_injection: "bg-red-900 text-red-200",
    data_masked: "bg-blue-900 text-blue-200",
    tool_blocked: "bg-yellow-900 text-yellow-200",
  };
  const labels: Record<string, string> = {
    prompt_injection: "Injection",
    data_masked: "Masked",
    tool_blocked: "Tool Block",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[type] || "bg-gray-700 text-gray-300"
      }`}
    >
      {labels[type] || type}
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
      setError("Name is required");
      return;
    }
    if (!newPattern.trim()) {
      setError("Pattern is required");
      return;
    }
    if (!validatePattern(newPattern)) {
      setError("Invalid regex pattern");
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
      setError("Name is required");
      return;
    }
    if (!newPattern.trim()) {
      setError("Pattern is required");
      return;
    }
    if (!validatePattern(newPattern)) {
      setError("Invalid regex pattern");
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
            + Add Pattern
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
                  placeholder="Pattern name"
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white"
                />
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="Regex pattern"
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(index)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
                  >
                    Cancel
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
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
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
            placeholder="Pattern name"
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white"
          />
          <input
            type="text"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder="Regex pattern (e.g., secret_\w+)"
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              Add
            </button>
            <button
              onClick={cancelEdit}
              className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {patterns.length === 0 && !isAdding && (
        <p className="text-xs text-gray-500">No custom patterns configured</p>
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
