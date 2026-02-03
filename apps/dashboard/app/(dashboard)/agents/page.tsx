import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AgentList } from "./agent-list";

export default async function AgentsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-400">Please sign in to view your agents.</p>
      </div>
    );
  }

  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, agent_id, name, status, last_heartbeat_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="py-12">
        <p className="text-red-400">Failed to load agents: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Agents</h1>
      <AgentList initialAgents={agents ?? []} />
    </div>
  );
}
