import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function DashboardHome() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Query agent count for this user
  const { count: agentCount } = await supabase
    .from("agents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Welcome back, {user!.email}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Agents summary card */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400">Agents</h3>
          <p className="mt-2 text-3xl font-bold text-white">
            {agentCount ?? 0}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            You have {agentCount ?? 0} agent{agentCount !== 1 ? "s" : ""} registered
          </p>
        </div>

        {/* Alerts placeholder card */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400">Alerts</h3>
          <p className="mt-2 text-3xl font-bold text-white">--</p>
          <p className="mt-1 text-sm text-gray-500">
            Alert monitoring coming soon
          </p>
        </div>

        {/* API Keys placeholder card */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400">API Keys</h3>
          <p className="mt-2 text-3xl font-bold text-white">--</p>
          <p className="mt-1 text-sm text-gray-500">
            Manage keys in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
