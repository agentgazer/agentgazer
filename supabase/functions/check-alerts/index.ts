import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COOLDOWN_MINUTES = 15;
const DEFAULT_AGENT_DOWN_MINUTES = 10;
const DEFAULT_ERROR_RATE_THRESHOLD = 0.2;
const DEFAULT_ERROR_RATE_WINDOW_MINUTES = 5;
const DEFAULT_BUDGET_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AlertRule {
  id: string;
  user_id: string;
  agent_id: string;
  rule_type: "agent_down" | "error_rate" | "budget";
  config: Record<string, unknown>;
  enabled: boolean;
  webhook_url: string | null;
  email: string | null;
}

interface Agent {
  agent_id: string;
  last_heartbeat_at: string | null;
  status: string;
}

interface AlertPayload {
  alert_type: string;
  agent_id: string;
  message: string;
  timestamp: string;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CORS headers helper
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Cooldown check: skip if the same rule fired within the last 15 minutes
// ---------------------------------------------------------------------------
async function isInCooldown(ruleId: string): Promise<boolean> {
  const cooldownCutoff = new Date(
    Date.now() - COOLDOWN_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("alert_history")
    .select("id")
    .eq("alert_rule_id", ruleId)
    .gte("delivered_at", cooldownCutoff)
    .limit(1);

  if (error) {
    console.error("Cooldown check error:", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Deliver alert via webhook
// ---------------------------------------------------------------------------
async function deliverWebhook(
  webhookUrl: string,
  payload: AlertPayload
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `Webhook delivery failed (${res.status}): ${await res.text()}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("Webhook delivery error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Deliver alert via email (Resend API)
// ---------------------------------------------------------------------------
async function deliverEmail(
  email: string,
  payload: AlertPayload
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured, skipping email delivery.");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "alerts@agentgazer.com",
        to: email,
        subject: `[AgentGazer] ${payload.alert_type}: ${payload.agent_id}`,
        text: `${payload.message}\n\nTimestamp: ${payload.timestamp}\nAgent: ${payload.agent_id}\nAlert Type: ${payload.alert_type}\n\nDetails: ${JSON.stringify(payload.details, null, 2)}`,
      }),
    });

    if (!res.ok) {
      console.error(
        `Email delivery failed (${res.status}): ${await res.text()}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email delivery error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Record alert in history and deliver
// ---------------------------------------------------------------------------
async function fireAlert(
  rule: AlertRule,
  payload: AlertPayload
): Promise<void> {
  // Deliver via webhook if configured
  if (rule.webhook_url) {
    const success = await deliverWebhook(rule.webhook_url, payload);
    if (success) {
      await supabase.from("alert_history").insert({
        user_id: rule.user_id,
        alert_rule_id: rule.id,
        agent_id: rule.agent_id,
        rule_type: rule.rule_type,
        message: payload.message,
        delivered_via: "webhook",
      });
    }
  }

  // Deliver via email if configured
  if (rule.email) {
    const success = await deliverEmail(rule.email, payload);
    if (success) {
      await supabase.from("alert_history").insert({
        user_id: rule.user_id,
        alert_rule_id: rule.id,
        agent_id: rule.agent_id,
        rule_type: rule.rule_type,
        message: payload.message,
        delivered_via: "email",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluate: agent_down
// ---------------------------------------------------------------------------
async function evaluateAgentDown(
  rule: AlertRule,
  agent: Agent | null
): Promise<AlertPayload | null> {
  if (!agent || !agent.last_heartbeat_at) {
    return null;
  }

  const durationMinutes =
    typeof rule.config.duration_minutes === "number"
      ? rule.config.duration_minutes
      : DEFAULT_AGENT_DOWN_MINUTES;

  const cutoff = new Date(Date.now() - durationMinutes * 60 * 1000);
  const lastHeartbeat = new Date(agent.last_heartbeat_at);

  if (lastHeartbeat < cutoff) {
    const downMinutes = Math.round(
      (Date.now() - lastHeartbeat.getTime()) / 60000
    );
    return {
      alert_type: "agent_down",
      agent_id: rule.agent_id,
      message: `Agent '${rule.agent_id}' has been down for ${downMinutes} minutes`,
      timestamp: new Date().toISOString(),
      details: {
        last_heartbeat_at: agent.last_heartbeat_at,
        threshold_minutes: durationMinutes,
        down_minutes: downMinutes,
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Evaluate: error_rate
// ---------------------------------------------------------------------------
async function evaluateErrorRate(
  rule: AlertRule
): Promise<AlertPayload | null> {
  const threshold =
    typeof rule.config.threshold === "number"
      ? rule.config.threshold / 100
      : DEFAULT_ERROR_RATE_THRESHOLD;

  const windowMinutes =
    typeof rule.config.window_minutes === "number"
      ? rule.config.window_minutes
      : DEFAULT_ERROR_RATE_WINDOW_MINUTES;

  const windowStart = new Date(
    Date.now() - windowMinutes * 60 * 1000
  ).toISOString();

  // Fetch all events in the rolling window for this agent and user
  const { data: events, error } = await supabase
    .from("agent_events")
    .select("status_code")
    .eq("user_id", rule.user_id)
    .eq("agent_id", rule.agent_id)
    .gte("timestamp", windowStart);

  if (error) {
    console.error("Error querying events for error_rate:", error);
    return null;
  }

  if (!events || events.length === 0) {
    return null;
  }

  const total = events.length;
  const errors = events.filter(
    (e: { status_code: number | null }) =>
      e.status_code !== null && e.status_code >= 400
  ).length;
  const errorRate = errors / total;

  if (errorRate > threshold) {
    const errorPct = Math.round(errorRate * 100);
    const thresholdPct = Math.round(threshold * 100);
    return {
      alert_type: "error_rate",
      agent_id: rule.agent_id,
      message: `Agent '${rule.agent_id}' error rate is ${errorPct}% (threshold: ${thresholdPct}%) over the last ${windowMinutes} minutes`,
      timestamp: new Date().toISOString(),
      details: {
        error_rate: errorRate,
        threshold,
        total_events: total,
        error_events: errors,
        window_minutes: windowMinutes,
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Evaluate: budget
// ---------------------------------------------------------------------------
async function evaluateBudget(rule: AlertRule): Promise<AlertPayload | null> {
  const budgetThreshold =
    typeof rule.config.threshold === "number"
      ? rule.config.threshold
      : DEFAULT_BUDGET_THRESHOLD;

  // Get start of the current day in UTC
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();

  // Query sum of cost_usd for today
  const { data: events, error } = await supabase
    .from("agent_events")
    .select("cost_usd")
    .eq("user_id", rule.user_id)
    .eq("agent_id", rule.agent_id)
    .gte("timestamp", dayStart)
    .not("cost_usd", "is", null);

  if (error) {
    console.error("Error querying events for budget:", error);
    return null;
  }

  if (!events || events.length === 0) {
    return null;
  }

  const totalCost = events.reduce(
    (sum: number, e: { cost_usd: number | null }) => sum + (e.cost_usd ?? 0),
    0
  );

  if (totalCost > budgetThreshold) {
    return {
      alert_type: "budget",
      agent_id: rule.agent_id,
      message: `Agent '${rule.agent_id}' daily spend is $${totalCost.toFixed(2)} (threshold: $${budgetThreshold.toFixed(2)})`,
      timestamp: new Date().toISOString(),
      details: {
        total_cost_usd: totalCost,
        threshold_usd: budgetThreshold,
        period: "daily",
        period_start: dayStart,
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Accept POST (cron trigger) or GET (manual invocation)
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    // -------------------------------------------------------------------
    // 1. Fetch all enabled alert rules
    // -------------------------------------------------------------------
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesError) {
      console.error("Error fetching alert rules:", rulesError);
      return jsonResponse({ error: "Failed to fetch alert rules." }, 500);
    }

    if (!rules || rules.length === 0) {
      return jsonResponse({ message: "No enabled alert rules found.", alerts_fired: 0 });
    }

    // -------------------------------------------------------------------
    // 2. Fetch all agents referenced by rules for agent_down checks
    // -------------------------------------------------------------------
    const agentDownRules = rules.filter(
      (r: AlertRule) => r.rule_type === "agent_down"
    );
    const agentIds = [
      ...new Set(agentDownRules.map((r: AlertRule) => r.agent_id)),
    ];
    const userIds = [
      ...new Set(agentDownRules.map((r: AlertRule) => r.user_id)),
    ];

    let agentsMap = new Map<string, Agent>();

    if (agentIds.length > 0) {
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select("user_id, agent_id, last_heartbeat_at, status")
        .in("agent_id", agentIds)
        .in("user_id", userIds);

      if (agentsError) {
        console.error("Error fetching agents:", agentsError);
      } else if (agents) {
        for (const agent of agents) {
          const key = `${agent.user_id}:${agent.agent_id}`;
          agentsMap.set(key, agent as Agent);
        }
      }
    }

    // -------------------------------------------------------------------
    // 3. Evaluate each rule
    // -------------------------------------------------------------------
    let alertsFired = 0;
    const results: Array<{
      rule_id: string;
      agent_id: string;
      rule_type: string;
      fired: boolean;
      skipped_reason?: string;
    }> = [];

    for (const rule of rules as AlertRule[]) {
      // Check if rule has at least one delivery channel
      if (!rule.webhook_url && !rule.email) {
        results.push({
          rule_id: rule.id,
          agent_id: rule.agent_id,
          rule_type: rule.rule_type,
          fired: false,
          skipped_reason: "no_delivery_channel",
        });
        continue;
      }

      // Check cooldown
      const inCooldown = await isInCooldown(rule.id);
      if (inCooldown) {
        results.push({
          rule_id: rule.id,
          agent_id: rule.agent_id,
          rule_type: rule.rule_type,
          fired: false,
          skipped_reason: "cooldown",
        });
        continue;
      }

      // Evaluate the rule condition
      let payload: AlertPayload | null = null;

      switch (rule.rule_type) {
        case "agent_down": {
          const agentKey = `${rule.user_id}:${rule.agent_id}`;
          const agent = agentsMap.get(agentKey) ?? null;
          payload = await evaluateAgentDown(rule, agent);
          break;
        }
        case "error_rate": {
          payload = await evaluateErrorRate(rule);
          break;
        }
        case "budget": {
          payload = await evaluateBudget(rule);
          break;
        }
        default:
          console.error(`Unknown rule_type: ${rule.rule_type}`);
      }

      if (payload) {
        await fireAlert(rule, payload);
        alertsFired++;
        results.push({
          rule_id: rule.id,
          agent_id: rule.agent_id,
          rule_type: rule.rule_type,
          fired: true,
        });
      } else {
        results.push({
          rule_id: rule.id,
          agent_id: rule.agent_id,
          rule_type: rule.rule_type,
          fired: false,
          skipped_reason: "condition_not_met",
        });
      }
    }

    return jsonResponse({
      message: "Alert check complete.",
      rules_evaluated: rules.length,
      alerts_fired: alertsFired,
      results,
    });
  } catch (err) {
    console.error("Unhandled error in check-alerts:", err);
    return jsonResponse({ error: "Internal server error." }, 500);
  }
});
