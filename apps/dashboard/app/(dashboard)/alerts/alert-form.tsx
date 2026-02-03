"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Agent {
  id: string;
  agent_id: string;
  name: string | null;
}

type RuleType = "agent_down" | "error_rate" | "budget";

interface ExistingRule {
  id: string;
  agent_id: string;
  rule_type: RuleType;
  config: Record<string, unknown>;
  webhook_url: string | null;
  email: string | null;
}

interface AlertFormProps {
  onSaved: () => void;
  onCancel: () => void;
  editRule?: ExistingRule;
}

// ---------------------------------------------------------------------------
// Config components per rule type
// ---------------------------------------------------------------------------
function AgentDownConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const durationMinutes = (config.duration_minutes as number) ?? 10;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300">
        Down duration (minutes)
      </label>
      <input
        type="number"
        min={1}
        value={durationMinutes}
        onChange={(e) =>
          onChange({ ...config, duration_minutes: parseInt(e.target.value) || 10 })
        }
        className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <p className="mt-1 text-xs text-gray-500">
        Alert if no heartbeat received for this many minutes.
      </p>
    </div>
  );
}

function ErrorRateConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const threshold = (config.threshold as number) ?? 20;
  const windowMinutes = (config.window_minutes as number) ?? 5;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Error rate threshold (%)
        </label>
        <input
          type="number"
          min={1}
          max={100}
          value={threshold}
          onChange={(e) =>
            onChange({ ...config, threshold: parseInt(e.target.value) || 20 })
          }
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Alert if the percentage of requests with status &gt;= 400 exceeds this value.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Rolling window (minutes)
        </label>
        <input
          type="number"
          min={1}
          value={windowMinutes}
          onChange={(e) =>
            onChange({
              ...config,
              window_minutes: parseInt(e.target.value) || 5,
            })
          }
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

function BudgetConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const threshold = (config.threshold as number) ?? 50;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300">
        Daily budget threshold (USD)
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
          $
        </span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={threshold}
          onChange={(e) =>
            onChange({
              ...config,
              threshold: parseFloat(e.target.value) || 50,
            })
          }
          className="block w-full rounded-md border border-gray-700 bg-gray-800 py-2 pl-7 pr-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Alert if total daily spend for this agent exceeds this amount.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default configs per rule type
// ---------------------------------------------------------------------------
function getDefaultConfig(ruleType: RuleType): Record<string, unknown> {
  switch (ruleType) {
    case "agent_down":
      return { duration_minutes: 10 };
    case "error_rate":
      return { threshold: 20, window_minutes: 5 };
    case "budget":
      return { threshold: 50 };
  }
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------
export default function AlertForm({ onSaved, onCancel, editRule }: AlertFormProps) {
  const isEditing = !!editRule;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — pre-populate from editRule when editing
  const [agentId, setAgentId] = useState(editRule?.agent_id ?? "");
  const [ruleType, setRuleType] = useState<RuleType>(editRule?.rule_type ?? "agent_down");
  const [config, setConfig] = useState<Record<string, unknown>>(
    editRule?.config ?? getDefaultConfig("agent_down")
  );
  const [webhookUrl, setWebhookUrl] = useState(editRule?.webhook_url ?? "");
  const [email, setEmail] = useState(editRule?.email ?? "");

  const supabase = createClient();

  // -----------------------------------------------------------------------
  // Load user's agents
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function loadAgents() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("agents")
        .select("id, agent_id, name")
        .order("agent_id", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setAgents(data ?? []);
        if (data && data.length > 0) {
          setAgentId(data[0].agent_id);
        }
      }
      setLoading(false);
    }
    loadAgents();
  }, []);

  // -----------------------------------------------------------------------
  // When rule type changes, reset config to defaults
  // -----------------------------------------------------------------------
  function handleRuleTypeChange(newType: RuleType) {
    setRuleType(newType);
    setConfig(getDefaultConfig(newType));
  }

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agentId) {
      setError("Please select an agent.");
      return;
    }

    if (!webhookUrl && !email) {
      setError("Please configure at least one notification channel (webhook or email).");
      return;
    }

    setSaving(true);

    const ruleData = {
      agent_id: agentId,
      rule_type: ruleType,
      config,
      webhook_url: webhookUrl || null,
      email: email || null,
      updated_at: new Date().toISOString(),
    };

    let saveError;
    if (isEditing) {
      const { error: updateError } = await supabase
        .from("alert_rules")
        .update(ruleData)
        .eq("id", editRule.id);
      saveError = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("alert_rules")
        .insert({ ...ruleData, enabled: true });
      saveError = insertError;
    }

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-white">
          {isEditing ? "Edit Alert Rule" : "New Alert Rule"}
        </h1>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSave}
        className="rounded-lg border border-gray-700 bg-gray-800 p-6 space-y-6"
      >
        {/* Error banner */}
        {error && (
          <div className="rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Agent select */}
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Agent
          </label>
          {loading ? (
            <div className="mt-1 text-sm text-gray-500">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="mt-1 text-sm text-gray-500">
              No agents found. Send some events first to register an agent.
            </div>
          ) : (
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.agent_id}>
                  {agent.name
                    ? `${agent.name} (${agent.agent_id})`
                    : agent.agent_id}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Rule type */}
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Rule Type
          </label>
          <select
            value={ruleType}
            onChange={(e) =>
              handleRuleTypeChange(e.target.value as RuleType)
            }
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="agent_down">Agent Down</option>
            <option value="error_rate">Error Rate</option>
            <option value="budget">Budget</option>
          </select>
        </div>

        {/* Dynamic config section */}
        <div className="rounded-md border border-gray-700 bg-gray-900 p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-300">
            Configuration
          </h3>
          {ruleType === "agent_down" && (
            <AgentDownConfig config={config} onChange={setConfig} />
          )}
          {ruleType === "error_rate" && (
            <ErrorRateConfig config={config} onChange={setConfig} />
          )}
          {ruleType === "budget" && (
            <BudgetConfig config={config} onChange={setConfig} />
          )}
        </div>

        {/* Notification channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-300">
            Notification Channels
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-400">
              Webhook URL
              <span className="ml-1 text-xs text-gray-500">(optional)</span>
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/alert"
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">
              Email
              <span className="ml-1 text-xs text-gray-500">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <p className="text-xs text-gray-500">
            At least one notification channel is required.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading || agents.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : isEditing ? "Update Rule" : "Save Rule"}
          </button>
        </div>
      </form>
    </div>
  );
}
