import { z } from "zod";

export const EventType = z.enum(["llm_call", "completion", "heartbeat", "error", "custom"]);
export type EventType = z.infer<typeof EventType>;

export const Source = z.enum(["sdk", "proxy"]);
export type Source = z.infer<typeof Source>;

export const AgentEventSchema = z.object({
  id: z.string().uuid().optional(),
  agent_id: z.string().min(1),
  event_type: EventType,
  provider: z.string().nullish(),
  model: z.string().nullish(),
  requested_model: z.string().nullish(),
  tokens_in: z.number().int().nonnegative().nullish(),
  tokens_out: z.number().int().nonnegative().nullish(),
  tokens_total: z.number().int().nonnegative().nullish(),
  cost_usd: z.number().nonnegative().nullish(),
  latency_ms: z.number().int().nonnegative().nullish(),
  status_code: z.number().int().nullish(),
  error_message: z.string().nullish(),
  tags: z.record(z.unknown()).default({}),
  source: Source,
  timestamp: z.string().datetime(),
  trace_id: z.string().nullish(),
  span_id: z.string().nullish(),
  parent_span_id: z.string().nullish(),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const BatchEventsSchema = z.object({
  events: z.array(AgentEventSchema).min(1).max(500),
});

export type BatchEvents = z.infer<typeof BatchEventsSchema>;
