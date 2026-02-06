import { createLogger, type AgentEvent } from "@agentgazer/shared";

const log = createLogger("event-buffer");

export interface EventBufferOptions {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  maxBufferSize: number;
}

const MAX_BUFFER_CAP = 5000; // Hard cap to prevent unbounded memory growth
const FLUSH_TIMEOUT_MS = 30_000; // 30 seconds

export class EventBuffer {
  private buffer: AgentEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly flushInterval: number;
  private readonly maxBufferSize: number;
  private flushing = false;

  constructor(options: EventBufferOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint;
    this.flushInterval = options.flushInterval;
    this.maxBufferSize = options.maxBufferSize;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushInterval);
    // Allow the process to exit even if the timer is running
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  add(event: AgentEvent): void {
    this.buffer.push(event);
    // Drop oldest events if buffer exceeds hard cap
    if (this.buffer.length > MAX_BUFFER_CAP) {
      const dropped = this.buffer.length - MAX_BUFFER_CAP;
      this.buffer.splice(0, dropped);
      log.warn(`Buffer exceeded cap, dropped ${dropped} oldest events`);
    }
    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const events = this.buffer.splice(0, this.buffer.length);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(FLUSH_TIMEOUT_MS),
      });

      if (!response.ok) {
        log.error(`Failed to flush events: HTTP ${response.status}`);
        // Put events back at the front of the buffer for retry
        this.buffer.unshift(...events);
      }
    } catch (error) {
      log.error("Failed to flush events", { err: error instanceof Error ? error.message : String(error) });
      // Put events back at the front of the buffer for retry
      this.buffer.unshift(...events);
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  get pending(): number {
    return this.buffer.length;
  }
}
