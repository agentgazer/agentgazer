import type { AgentEvent } from "@agenttrace/shared";
import type { AgentTraceOptions, TrackOptions } from "./types.js";

const DEFAULT_ENDPOINT =
  "https://your-project.supabase.co/functions/v1/ingest";
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_BUFFER_SIZE = 50;

export class AgentTrace {
  private readonly apiKey: string;
  private readonly agentId: string;
  private readonly endpoint: string;
  private readonly maxBufferSize: number;
  private buffer: AgentEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  private constructor(options: AgentTraceOptions) {
    this.apiKey = options.apiKey;
    this.agentId = options.agentId;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;

    const interval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
    this.timer = setInterval(() => {
      void this.flush();
    }, interval);

    // Allow the Node process to exit even if the timer is still active.
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  static init(options: AgentTraceOptions): AgentTrace {
    if (!options.apiKey) {
      throw new Error("[AgentTrace] apiKey is required");
    }
    if (!options.agentId) {
      throw new Error("[AgentTrace] agentId is required");
    }
    return new AgentTrace(options);
  }

  // -------------------------------------------------------------------
  // Public sync methods — each builds an event and pushes to the buffer
  // -------------------------------------------------------------------

  track(options: TrackOptions): void {
    const event: AgentEvent = {
      agent_id: this.agentId,
      event_type: "llm_call",
      source: "sdk",
      timestamp: new Date().toISOString(),
      provider: options.provider ?? null,
      model: options.model ?? null,
      tokens_in: options.tokens?.input ?? null,
      tokens_out: options.tokens?.output ?? null,
      tokens_total: options.tokens?.total ?? null,
      latency_ms: options.latency_ms ?? null,
      status_code: options.status ?? null,
      error_message: options.error_message ?? null,
      tags: options.tags ?? {},
    };
    this.enqueue(event);
  }

  heartbeat(): void {
    const event: AgentEvent = {
      agent_id: this.agentId,
      event_type: "heartbeat",
      source: "sdk",
      timestamp: new Date().toISOString(),
      tags: {},
    };
    this.enqueue(event);
  }

  error(err: Error | string): void {
    const message = err instanceof Error ? err.message : err;
    const stack = err instanceof Error ? err.stack : undefined;
    const tags: Record<string, unknown> = {};
    if (stack) {
      tags.stack = stack;
    }
    const event: AgentEvent = {
      agent_id: this.agentId,
      event_type: "error",
      source: "sdk",
      timestamp: new Date().toISOString(),
      error_message: message,
      tags,
    };
    this.enqueue(event);
  }

  custom(data: Record<string, unknown>): void {
    const event: AgentEvent = {
      agent_id: this.agentId,
      event_type: "custom",
      source: "sdk",
      timestamp: new Date().toISOString(),
      tags: data,
    };
    this.enqueue(event);
  }

  // -------------------------------------------------------------------
  // Async methods
  // -------------------------------------------------------------------

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Snapshot and clear the buffer immediately so concurrent flushes
    // don't send duplicates, and so the buffer doesn't grow unbounded
    // even if the network call fails.
    const events = this.buffer;
    this.buffer = [];

    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({ events }),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.warn(`[AgentTrace] flush failed: ${message}`);
      // Buffer is already cleared — intentionally not re-queuing to
      // prevent unbounded growth.
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  private enqueue(event: AgentEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush();
    }
  }
}
