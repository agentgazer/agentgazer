import { createServerSupabaseClient } from "@/lib/supabase-server";
import { computeHealth, relativeTime } from "@/lib/format";
import { TimeRangeSelector } from "./time-range-selector";
import { RealtimeDetail } from "./realtime-detail";

const STATUS_CONFIG: Record<string, { label: string; dotClass: string }> = {
  healthy: { label: "Healthy", dotClass: "bg-green-500" },
  degraded: { label: "Degraded", dotClass: "bg-yellow-500" },
  down: { label: "Down", dotClass: "bg-red-500" },
  unknown: { label: "Unknown", dotClass: "bg-gray-500" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`}
      />
      {config.label}
    </span>
  );
}

export type TimeRange = "1h" | "24h" | "7d" | "30d" | "custom";

interface PageProps {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { agentId } = await params;
  const resolvedSearchParams = await searchParams;
  const range = (
    ["1h", "24h", "7d", "30d", "custom"].includes(resolvedSearchParams.range ?? "")
      ? resolvedSearchParams.range
      : "24h"
  ) as TimeRange;

  const customFrom = range === "custom" ? resolvedSearchParams.from : undefined;
  const customTo = range === "custom" ? resolvedSearchParams.to : undefined;

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-400">Please sign in to view agent details.</p>
      </div>
    );
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, agent_id, name, status, last_heartbeat_at, updated_at")
    .eq("user_id", user.id)
    .eq("agent_id", agentId)
    .single();

  if (error || !agent) {
    return (
      <div className="py-12">
        <p className="text-red-400">
          Agent not found or you do not have access.
        </p>
      </div>
    );
  }

  const health = computeHealth(agent.last_heartbeat_at);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">
            {agent.name ?? agent.agent_id}
          </h1>
          <StatusBadge status={health} />
        </div>
        <p className="mt-1 text-sm text-gray-400">
          ID: {agent.agent_id} &middot; Last heartbeat:{" "}
          {relativeTime(agent.last_heartbeat_at)}
        </p>
      </div>

      {/* Time range selector */}
      <TimeRangeSelector
        currentRange={range}
        customFrom={customFrom}
        customTo={customTo}
      />

      {/* Stats & charts with real-time refresh */}
      <RealtimeDetail
        agentId={agentId}
        range={range}
        customFrom={customFrom}
        customTo={customTo}
      />
    </div>
  );
}
