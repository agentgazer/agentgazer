export type {
  AgentEvent,
  BatchEvents,
  EventType,
  Source,
} from "@agenttrace/shared";

export { AgentEventSchema, BatchEventsSchema } from "@agenttrace/shared";

export interface AgentTraceOptions {
  apiKey: string;
  agentId: string;
  endpoint?: string;
  flushInterval?: number;
  maxBufferSize?: number;
}

export interface TrackOptions {
  provider?: string;
  model?: string;
  tokens?: { input?: number; output?: number; total?: number };
  latency_ms?: number;
  status?: number;
  tags?: Record<string, unknown>;
  error_message?: string;
}
