import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import FilterDropdown from "../components/FilterDropdown";

interface Agent {
  agent_id: string;
  status: string;
  last_heartbeat: string;
  total_events: number;
}

interface AgentsResponse {
  agents: Agent[];
  total?: number;
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "healthy", label: "Healthy" },
  { value: "degraded", label: "Degraded" },
  { value: "down", label: "Down" },
  { value: "unknown", label: "Unknown" },
];

export default function AgentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    return api.get<AgentsResponse>(`/api/agents?${params.toString()}`);
  }, [page, search, statusFilter]);

  const { data, error, loading } = usePolling(fetcher, 3000);

  const totalPages = data?.total != null ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleStatusChange(v: string) {
    setStatusFilter(v);
    setPage(1);
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

      {/* Search + Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search agents..."
          />
        </div>
        <FilterDropdown
          value={statusFilter}
          onChange={handleStatusChange}
          options={STATUS_OPTIONS}
          label="Statuses"
        />
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
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Heartbeat</th>
                  <th className="px-4 py-3 font-medium text-right">Total Events</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.agents.map((agent) => (
                  <tr
                    key={agent.agent_id}
                    className="bg-gray-900 transition-colors hover:bg-gray-800"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {agent.agent_id}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={agent.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {relativeTime(agent.last_heartbeat)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {agent.total_events.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/agents/${encodeURIComponent(agent.agent_id)}`}
                        className="text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
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
