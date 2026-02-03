"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type TimeRange = "1h" | "24h" | "7d" | "30d" | "custom";

interface StatsCardsProps {
  agentId: string;
  range: TimeRange;
  customFrom?: string;
  customTo?: string;
  refreshKey?: number;
}

interface Stats {
  totalRequests: number;
  totalCost: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  tokensUsed: number;
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function StatsCards({ agentId, range, customFrom, customTo, refreshKey }: StatsCardsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      const supabase = createClient();
      const since = rangeToISO(range, customFrom);

      let query = supabase
        .from("agent_events")
        .select(
          "event_type, cost_usd, status_code, latency_ms, tokens_total"
        )
        .eq("agent_id", agentId)
        .gte("timestamp", since);

      if (range === "custom" && customTo) {
        query = query.lte("timestamp", new Date(customTo).toISOString());
      }

      const { data: events, error } = await query;

      if (cancelled) return;

      if (error || !events) {
        setStats(null);
        setLoading(false);
        return;
      }

      const llmEvents = events.filter((e) => e.event_type === "llm_call" || e.event_type === "completion");
      const totalRequests = llmEvents.length;

      const totalCost = events.reduce(
        (sum, e) => sum + (e.cost_usd ?? 0),
        0
      );

      const errorCount = events.filter(
        (e) => e.status_code != null && e.status_code >= 400
      ).length;
      const errorRate =
        events.length > 0 ? (errorCount / events.length) * 100 : 0;

      const latencies = events
        .map((e) => e.latency_ms)
        .filter((v): v is number => v != null);
      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0;

      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95Latency =
        sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0
          : 0;
      const p99Latency =
        sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] ?? 0
          : 0;

      const tokensUsed = events.reduce(
        (sum, e) => sum + (e.tokens_total ?? 0),
        0
      );

      setStats({
        totalRequests,
        totalCost,
        errorRate,
        avgLatency,
        p95Latency,
        p99Latency,
        tokensUsed,
      });
      setLoading(false);
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [agentId, range, customFrom, customTo, refreshKey]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-gray-700 bg-gray-800"
          />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-sm text-gray-500">Unable to load stats.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Requests"
        value={stats.totalRequests.toLocaleString()}
      />
      <StatCard
        label="Total Cost"
        value={`$${stats.totalCost.toFixed(2)}`}
      />
      <StatCard
        label="Error Rate"
        value={`${stats.errorRate.toFixed(1)}%`}
      />
      <StatCard
        label="Tokens Used"
        value={stats.tokensUsed.toLocaleString()}
      />
      <StatCard
        label="P50 Latency"
        value={`${Math.round(stats.avgLatency)}ms`}
      />
      <StatCard
        label="P95 Latency"
        value={`${Math.round(stats.p95Latency)}ms`}
      />
      <StatCard
        label="P99 Latency"
        value={`${Math.round(stats.p99Latency)}ms`}
      />
    </div>
  );
}
