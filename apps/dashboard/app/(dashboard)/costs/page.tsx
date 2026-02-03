import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";

interface AgentCostRow {
  agent_id: string;
  agent_name: string | null;
  requests: number;
  total_cost: number;
}

export default async function CostsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-400">Please sign in to view cost data.</p>
      </div>
    );
  }

  // Fetch all events for cost aggregation
  const { data: events, error: eventsError } = await supabase
    .from("agent_events")
    .select("agent_id, cost_usd, event_type")
    .eq("user_id", user.id);

  // Fetch agents for name mapping
  const { data: agents } = await supabase
    .from("agents")
    .select("agent_id, name")
    .eq("user_id", user.id);

  if (eventsError) {
    return (
      <div className="py-12">
        <p className="text-red-400">
          Failed to load cost data: {eventsError.message}
        </p>
      </div>
    );
  }

  // Build name lookup
  const nameMap = new Map<string, string | null>();
  if (agents) {
    for (const a of agents) {
      nameMap.set(a.agent_id, a.name);
    }
  }

  // Group by agent_id
  const costMap = new Map<
    string,
    { requests: number; total_cost: number }
  >();

  if (events) {
    for (const event of events) {
      const existing = costMap.get(event.agent_id) ?? {
        requests: 0,
        total_cost: 0,
      };
      if (event.event_type === "llm_call" || event.event_type === "completion") {
        existing.requests += 1;
      }
      existing.total_cost += event.cost_usd ?? 0;
      costMap.set(event.agent_id, existing);
    }
  }

  const rows: AgentCostRow[] = Array.from(costMap.entries())
    .map(([agentId, data]) => ({
      agent_id: agentId,
      agent_name: nameMap.get(agentId) ?? null,
      requests: data.requests,
      total_cost: data.total_cost,
    }))
    .sort((a, b) => b.total_cost - a.total_cost);

  const totalSpend = rows.reduce((sum, r) => sum + r.total_cost, 0);
  const totalRequests = rows.reduce((sum, r) => sum + r.requests, 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Costs</h1>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <p className="text-sm text-gray-400">Total Spend</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            ${totalSpend.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <p className="text-sm text-gray-400">Total Requests</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {totalRequests.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <p className="text-sm text-gray-400">Active Agents</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {rows.length}
          </p>
        </div>
      </div>

      {/* Per-agent table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
          <p className="text-gray-400">
            No cost data yet. Costs appear here once your agents start making
            LLM calls.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <h2 className="mb-4 text-sm font-medium text-gray-300">
            Cost by Agent
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Agent</th>
                  <th className="pb-2 pr-4 text-right font-medium">
                    Requests
                  </th>
                  <th className="pb-2 pr-4 text-right font-medium">
                    Total Cost
                  </th>
                  <th className="pb-2 text-right font-medium">Avg Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.agent_id}
                    className="border-b border-gray-700/50 last:border-0"
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/agents/${row.agent_id}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {row.agent_name ?? row.agent_id}
                      </Link>
                      {row.agent_name && (
                        <span className="ml-2 text-xs text-gray-500">
                          {row.agent_id}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-300">
                      {row.requests.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right text-white">
                      ${row.total_cost.toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-400">
                      $
                      {row.requests > 0
                        ? (row.total_cost / row.requests).toFixed(4)
                        : "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
