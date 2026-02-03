"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime";
import { StatsCards } from "./stats-cards";
import { TokenChart } from "./token-chart";
import { CostBreakdown } from "./cost-breakdown";

type TimeRange = "1h" | "24h" | "7d" | "30d" | "custom";

interface RealtimeDetailProps {
  agentId: string;
  range: TimeRange;
  customFrom?: string;
  customTo?: string;
}

export function RealtimeDetail({
  agentId,
  range,
  customFrom,
  customTo,
}: RealtimeDetailProps) {
  const refreshKey = useRealtimeRefresh(agentId);

  return (
    <>
      <StatsCards
        agentId={agentId}
        range={range}
        customFrom={customFrom}
        customTo={customTo}
        refreshKey={refreshKey}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TokenChart
          agentId={agentId}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          refreshKey={refreshKey}
        />
        <CostBreakdown
          agentId={agentId}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          refreshKey={refreshKey}
        />
      </div>
    </>
  );
}
