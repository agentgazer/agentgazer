import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { relativeTime, formatCost } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";

interface ProviderInfo {
  provider: string;
  has_override: boolean;
}

interface Agent {
  agent_id: string;
  updated_at: string;
  active: number;
  kill_switch_enabled?: number;
  total_tokens: number;
  total_cost: number;
  today_cost: number;
  providers?: ProviderInfo[];
}

interface AgentsResponse {
  agents: Agent[];
  total?: number;
}

const PAGE_SIZE = 20;

export default function AgentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    if (search) params.set("search", search);
    return api.get<AgentsResponse>(`/api/agents?${params.toString()}`);
  }, [page, search]);

  const { data, error, loading, refresh } = usePolling(fetcher, 3000);

  const totalPages = data?.total != null ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  async function handleToggleActive(agent: Agent) {
    setTogglingAgent(agent.agent_id);
    try {
      await api.put(`/api/agents/${encodeURIComponent(agent.agent_id)}/policy`, {
        active: agent.active === 0,
      });
      refresh();
    } catch (err) {
      console.error("Failed to toggle agent active state:", err);
    } finally {
      setTogglingAgent(null);
    }
  }

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Agents</h1>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Search bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search agents..."
          />
        </div>
      </div>

      {data && data.agents.length === 0 && (
        <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
          <p className="text-gray-400">No agents found.</p>
        </div>
      )}

      {data && data.agents.length > 0 && (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-700">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                  <th className="px-4 py-3 font-medium">Agent ID</th>
                  <th className="px-4 py-3 font-medium text-center">Active</th>
                  <th className="px-4 py-3 font-medium">Providers</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium text-right">Tokens</th>
                  <th className="px-4 py-3 font-medium text-right">Total Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Today</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.agents.map((agent) => {
                  const isToggling = togglingAgent === agent.agent_id;

                  return (
                    <tr
                      key={agent.agent_id}
                      className="bg-gray-900 transition-colors hover:bg-gray-800"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/agents/${encodeURIComponent(agent.agent_id)}`}
                            className="font-medium text-blue-400 hover:text-blue-300"
                          >
                            {agent.agent_id}
                          </Link>
                          {agent.kill_switch_enabled === 1 && (
                            <span
                              className="inline-flex items-center rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400"
                              title="Kill switch enabled for loop detection"
                            >
                              Kill Switch
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(agent)}
                          disabled={isToggling}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                            agent.active ? "bg-green-600" : "bg-gray-600"
                          }`}
                          role="switch"
                          aria-checked={agent.active === 1}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                              agent.active ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {agent.providers && agent.providers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {agent.providers.map((p) => (
                              <span
                                key={p.provider}
                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                                  p.has_override
                                    ? "bg-indigo-900 text-indigo-200"
                                    : "bg-gray-700 text-gray-300"
                                }`}
                              >
                                {p.provider}
                                {p.has_override && (
                                  <svg
                                    className="ml-1 h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {relativeTime(agent.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {agent.total_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatCost(agent.total_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatCost(agent.today_cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
