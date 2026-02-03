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
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
}

export interface Trace {
  traceId: string;
  startSpan(name?: string): Span;
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  startSpan(name?: string): Span;
}
