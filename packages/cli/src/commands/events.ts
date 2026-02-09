import { apiGet, handleApiError } from "../utils/api.js";
import { parseRange } from "../utils/format.js";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

interface EventRecord {
  id: string;
  agent_id: string;
  event_type: string;
  provider: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_total: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  source: string;
  timestamp: string;
  trace_id: string | null;
  tags: unknown;
}

interface EventsResponse {
  events: EventRecord[];
  total: number;
  offset: number;
  limit: number;
}

interface EventsFlags {
  agent?: string;
  a?: string;
  type?: string;
  t?: string;
  provider?: string;
  p?: string;
  since?: string;
  s?: string;
  limit?: string;
  n?: string;
  output?: string;
  o?: string;
  search?: string;
  follow?: string;
  f?: string;
  port?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatCost(cost: number | null): string {
  if (cost == null) return "-";
  if (cost < 0.0001) return "<$0.0001";
  return `$${cost.toFixed(4)}`;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + "…";
}

function getTypeColor(eventType: string): string {
  switch (eventType) {
    case "completion":
    case "llm_call":
      return colors.green;
    case "error":
      return colors.red;
    case "heartbeat":
      return colors.blue;
    case "blocked":
    case "kill_switch":
      return colors.yellow;
    case "custom":
      return colors.magenta;
    default:
      return colors.gray;
  }
}

function getStatusColor(statusCode: number | null): string {
  if (statusCode == null) return colors.dim;
  if (statusCode >= 200 && statusCode < 300) return colors.green;
  if (statusCode >= 400 && statusCode < 500) return colors.yellow;
  if (statusCode >= 500) return colors.red;
  return colors.dim;
}

function parseSince(since: string): string {
  const ms = parseRange(since);
  return new Date(Date.now() - ms).toISOString();
}

function buildQueryParams(flags: EventsFlags, sinceTimestamp?: string): URLSearchParams {
  const params = new URLSearchParams();

  const agent = flags.agent ?? flags.a;
  if (agent) params.set("agent_id", agent);

  const eventType = flags.type ?? flags.t;
  if (eventType) params.set("event_type", eventType);

  const provider = flags.provider ?? flags.p;
  if (provider) params.set("provider", provider);

  const search = flags.search;
  if (search) params.set("search", search);

  // Time range
  const since = flags.since ?? flags.s ?? "24h";
  const fromTime = sinceTimestamp ?? parseSince(since);
  params.set("from", fromTime);

  // Limit (default 50, max 1000)
  const limitStr = flags.limit ?? flags.n ?? "50";
  let limit = parseInt(limitStr, 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 1000) limit = 1000;
  params.set("limit", String(limit));

  return params;
}

function formatTableOutput(events: EventRecord[], total: number, since: string): void {
  const c = colors;

  console.log(`
${c.bold}  AgentGazer — Events${c.reset}
  ───────────────────────────────────────────────────────────────────────────────────────────────────
`);

  if (events.length === 0) {
    console.log("  No events found.\n");
    return;
  }

  // Header
  const header = `  ${"TIME".padEnd(20)}${"AGENT".padEnd(15)}${"TYPE".padEnd(13)}${"PROVIDER".padEnd(12)}${"MODEL".padEnd(18)}${"STATUS".padEnd(8)}${"COST".padEnd(10)}`;
  console.log(`${c.dim}${header}${c.reset}`);
  console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);

  for (const e of events) {
    const time = formatTime(e.timestamp).padEnd(20);
    const agent = truncate(e.agent_id ?? "", 14).padEnd(15);
    const typeColor = getTypeColor(e.event_type);
    const type = `${typeColor}${truncate(e.event_type ?? "", 12).padEnd(13)}${c.reset}`;
    const provider = truncate(e.provider ?? "-", 11).padEnd(12);
    const model = truncate(e.model ?? "-", 17).padEnd(18);
    const statusColor = getStatusColor(e.status_code);
    const status = `${statusColor}${String(e.status_code ?? "-").padEnd(8)}${c.reset}`;
    const cost = formatCost(e.cost_usd).padEnd(10);

    console.log(`  ${c.dim}${time}${c.reset}${c.cyan}${agent}${c.reset}${type}${c.dim}${provider}${c.reset}${model}${status}${c.dim}${cost}${c.reset}`);
  }

  // Summary
  console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);
  console.log(`  ${c.dim}Showing ${events.length} of ${total} events (last ${since})${c.reset}`);
  console.log("");
}

function formatJsonOutput(events: EventRecord[]): void {
  console.log(JSON.stringify({ events }, null, 2));
}

function formatCsvOutput(events: EventRecord[]): void {
  const headers = [
    "timestamp", "agent_id", "event_type", "provider", "model",
    "status_code", "cost_usd", "tokens_in", "tokens_out", "tokens_total",
    "latency_ms", "error_message", "source", "trace_id",
  ];

  console.log(headers.join(","));

  for (const e of events) {
    const values = headers.map((h) => {
      const val = (e as unknown as Record<string, unknown>)[h];
      if (val == null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    console.log(values.join(","));
  }
}

async function fetchEvents(port: number, params: URLSearchParams): Promise<EventsResponse> {
  return apiGet<EventsResponse>(`/api/events?${params.toString()}`, port);
}

async function followMode(port: number, flags: EventsFlags): Promise<void> {
  const c = colors;
  const since = flags.since ?? flags.s ?? "24h";
  let lastTimestamp: string | null = null;

  console.log(`${c.dim}Following events... (Ctrl+C to exit)${c.reset}\n`);

  // Signal handler for graceful exit
  let running = true;
  const handleExit = () => {
    running = false;
    console.log(`\n${c.dim}Stopped following events.${c.reset}`);
    process.exit(0);
  };
  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  // Initial fetch
  const initialParams = buildQueryParams(flags);
  try {
    const resp = await fetchEvents(port, initialParams);
    if (resp.events.length > 0) {
      formatTableOutput(resp.events, resp.total, since);
      lastTimestamp = resp.events[0].timestamp;
    } else {
      console.log(`  ${c.dim}No events yet...${c.reset}\n`);
    }
  } catch (err) {
    handleApiError(err);
  }

  // Poll every 3 seconds
  while (running) {
    await new Promise((r) => setTimeout(r, 3000));
    if (!running) break;

    try {
      const params = buildQueryParams(flags, lastTimestamp ?? undefined);
      const resp = await fetchEvents(port, params);

      // Filter to only show new events (after lastTimestamp)
      const newEvents = lastTimestamp
        ? resp.events.filter((e) => new Date(e.timestamp) > new Date(lastTimestamp!))
        : resp.events;

      if (newEvents.length > 0) {
        // Update lastTimestamp to the most recent
        lastTimestamp = newEvents[0].timestamp;

        // Print new events in table format (without header)
        for (const e of newEvents.reverse()) {
          const time = formatTime(e.timestamp).padEnd(20);
          const agent = truncate(e.agent_id ?? "", 14).padEnd(15);
          const typeColor = getTypeColor(e.event_type);
          const type = `${typeColor}${truncate(e.event_type ?? "", 12).padEnd(13)}${c.reset}`;
          const provider = truncate(e.provider ?? "-", 11).padEnd(12);
          const model = truncate(e.model ?? "-", 17).padEnd(18);
          const statusColor = getStatusColor(e.status_code);
          const status = `${statusColor}${String(e.status_code ?? "-").padEnd(8)}${c.reset}`;
          const cost = formatCost(e.cost_usd).padEnd(10);

          console.log(`  ${c.dim}${time}${c.reset}${c.cyan}${agent}${c.reset}${type}${c.dim}${provider}${c.reset}${model}${status}${c.dim}${cost}${c.reset}`);
        }
      }
    } catch {
      // Silently continue on error during polling
    }
  }
}

export async function cmdEvents(flags: EventsFlags): Promise<void> {
  const port = flags.port ? parseInt(flags.port, 10) : 18800;
  const outputFormat = flags.output ?? flags.o ?? "table";
  const isFollow = "follow" in flags || "f" in flags;

  // Follow mode
  if (isFollow) {
    await followMode(port, flags);
    return;
  }

  // Build query params
  const since = flags.since ?? flags.s ?? "24h";
  const params = buildQueryParams(flags);

  try {
    const resp = await fetchEvents(port, params);

    switch (outputFormat) {
      case "json":
        formatJsonOutput(resp.events);
        break;
      case "csv":
        formatCsvOutput(resp.events);
        break;
      case "table":
      default:
        formatTableOutput(resp.events, resp.total, since);
        break;
    }
  } catch (err) {
    handleApiError(err);
  }
}
