"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface AgentRow {
  id: string;
  agent_id: string;
  name: string | null;
  status: string;
  last_heartbeat_at: string | null;
  updated_at: string;
}

/**
 * Subscribe to real-time updates on the agents table.
 * Returns the latest agent list, merging INSERT/UPDATE payloads into the initial data.
 */
export function useRealtimeAgents(initialAgents: AgentRow[]): AgentRow[] {
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setAgents(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("agents-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agents" },
        (payload) => {
          const newAgent = payload.new as AgentRow;
          setAgents((prev) => {
            if (prev.some((a) => a.id === newAgent.id)) return prev;
            return [newAgent, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agents" },
        (payload) => {
          const updated = payload.new as AgentRow;
          setAgents((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "agents" },
        (payload) => {
          const deleted = payload.old as { id: string };
          setAgents((prev) => prev.filter((a) => a.id !== deleted.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return agents;
}

/**
 * Subscribe to new agent_events for a specific agent.
 * Returns a counter that increments on each new event — use it as a
 * dependency / key to trigger refetches in child components.
 */
export function useRealtimeRefresh(agentId: string): number {
  const [refreshKey, setRefreshKey] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`events-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_events",
          filter: `agent_id=eq.${agentId}`,
        },
        () => {
          setRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  return refreshKey;
}
