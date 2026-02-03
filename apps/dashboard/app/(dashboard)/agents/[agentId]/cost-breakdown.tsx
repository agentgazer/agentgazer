"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type TimeRange = "1h" | "24h" | "7d" | "30d" | "custom";

interface CostBreakdownProps {
  agentId: string;
  range: TimeRange;
  customFrom?: string;
  customTo?: string;
  refreshKey?: number;
}

interface CostRow {
  provider: string;
  model: string;
  requests: number;
  totalCost: number;
  avgCost: number;
}

function rangeToISO(range: TimeRange, customFrom?: string): string {
  if (range === "custom" && customFrom) {
    return new Date(customFrom).toISOString();
  }
  const now = new Date();
  switch (range) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
    default:
      return new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
  }
}

export function CostBreakdown({ agentId, range, customFrom, customTo, refreshKey }: CostBreakdownProps) {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const since = rangeToISO(range, customFrom);

      let query = supabase
        .from("agent_events")
        .select("provider, model, cost_usd")
        .eq("agent_id", agentId)
        .in("event_type", ["llm_call", "completion"])
        .gte("timestamp", since);

      if (range === "custom" && customTo) {
        query = query.lte("timestamp", new Date(customTo).toISOString());
      }

      const { data: events, error } = await query;

      if (cancelled) return;

      if (error || !events) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Group by provider + model
      const map = new Map<
        string,
        { provider: string; model: string; requests: number; totalCost: number }
      >();

      for (const event of events) {
        const provider = event.provider ?? "unknown";
        const model = event.model ?? "unknown";
        const key = `${provider}::${model}`;
        const existing = map.get(key) ?? {
          provider,
          model,
          requests: 0,
          totalCost: 0,
        };
        existing.requests += 1;
        existing.totalCost += event.cost_usd ?? 0;
        map.set(key, existing);
      }

      const result = Array.from(map.values())
        .map((row) => ({
          ...row,
          avgCost: row.requests > 0 ? row.totalCost / row.requests : 0,
        }))
        .sort((a, b) => b.totalCost - a.totalCost);

      setRows(result);
      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [agentId, range, customFrom, customTo, refreshKey]);

  if (loading) {
    return (
      <div className="h-72 animate-pulse rounded-lg border border-gray-700 bg-gray-800" />
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <h3 className="mb-4 text-sm font-medium text-gray-300">
        Cost Breakdown by Model
      </h3>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No cost data for this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-4 font-medium">Provider</th>
                <th className="pb-2 pr-4 font-medium">Model</th>
                <th className="pb-2 pr-4 text-right font-medium">Requests</th>
                <th className="pb-2 pr-4 text-right font-medium">
                  Total Cost
                </th>
                <th className="pb-2 text-right font-medium">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-700/50 last:border-0"
                >
                  <td className="py-2 pr-4 text-gray-300">{row.provider}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-300">
                    {row.model}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {row.requests.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right text-white">
                    ${row.totalCost.toFixed(4)}
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    ${row.avgCost.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
