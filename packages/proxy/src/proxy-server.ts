import * as http from "node:http";
import {
  detectProvider,
  getProviderBaseUrl,
  parseProviderResponse,
  calculateCost,
  createLogger,
  type AgentEvent,
  type ParsedResponse,
} from "@agenttrace/shared";

const log = createLogger("proxy");
import { EventBuffer } from "./event-buffer.js";

export interface ProxyOptions {
  port?: number;
  apiKey: string;
  agentId: string;
  endpoint?: string;
  flushInterval?: number;
  maxBufferSize?: number;
}

export interface ProxyServer {
  server: http.Server;
  shutdown: () => Promise<void>;
}

const DEFAULT_PORT = 4000;
const DEFAULT_ENDPOINT = "https://ingest.agenttrace.dev/v1/events";
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_BUFFER_SIZE = 50;

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// SSE streaming parsers — extract usage/model from provider-specific formats
// ---------------------------------------------------------------------------

function parseOpenAISSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let tokensTotal: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.model) model = data.model;
      if (data.usage) {
        tokensIn = data.usage.prompt_tokens ?? null;
        tokensOut = data.usage.completion_tokens ?? null;
        tokensTotal = data.usage.total_tokens ?? null;
      }
    } catch {
      continue;
    }
  }

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

function parseAnthropicSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.type === "message_start" && data.message) {
        model = data.message.model ?? null;
        tokensIn = data.message.usage?.input_tokens ?? null;
      }
      if (data.type === "message_delta" && data.usage) {
        tokensOut = data.usage.output_tokens ?? null;
      }
    } catch {
      continue;
    }
  }

  const tokensTotal =
    tokensIn != null && tokensOut != null ? tokensIn + tokensOut : null;

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

function parseGoogleSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let tokensTotal: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.modelVersion) model = data.modelVersion;
      if (data.usageMetadata) {
        tokensIn = data.usageMetadata.promptTokenCount ?? null;
        tokensOut = data.usageMetadata.candidatesTokenCount ?? null;
        tokensTotal = data.usageMetadata.totalTokenCount ?? null;
      }
    } catch {
      continue;
    }
  }

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

function parseCohereSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.meta?.billed_units) {
        tokensIn = data.meta.billed_units.input_tokens ?? null;
        tokensOut = data.meta.billed_units.output_tokens ?? null;
      }
      // Cohere v2 chat streaming uses response.meta at the end
      if (data.response?.meta?.billed_units) {
        tokensIn = data.response.meta.billed_units.input_tokens ?? null;
        tokensOut = data.response.meta.billed_units.output_tokens ?? null;
      }
    } catch {
      continue;
    }
  }

  const tokensTotal =
    tokensIn != null && tokensOut != null ? tokensIn + tokensOut : null;

  return {
    model: null,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

function parseSSEResponse(
  provider: string,
  sseText: string,
  statusCode: number
): ParsedResponse | null {
  const lines = sseText.split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      dataLines.push(line.slice(6));
    }
  }

  if (dataLines.length === 0) return null;

  switch (provider) {
    case "openai":
    case "mistral":
      return parseOpenAISSE(dataLines, statusCode);
    case "anthropic":
      return parseAnthropicSSE(dataLines, statusCode);
    case "google":
      return parseGoogleSSE(dataLines, statusCode);
    case "cohere":
      return parseCohereSSE(dataLines, statusCode);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Proxy server
// ---------------------------------------------------------------------------

export function startProxy(options: ProxyOptions): ProxyServer {
  const port = options.port ?? DEFAULT_PORT;
  const agentId = options.agentId;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
  const maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;

  const startTime = Date.now();

  const eventBuffer = new EventBuffer({
    apiKey: options.apiKey,
    endpoint,
    flushInterval,
    maxBufferSize,
  });
  eventBuffer.start();

  const server = http.createServer(
    (req: http.IncomingMessage, res: http.ServerResponse) => {
      void handleRequest(req, res);
    }
  );

  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";

    // Health check endpoint
    if (method === "GET" && path === "/health") {
      sendJson(res, 200, {
        status: "ok",
        agent_id: agentId,
        uptime_ms: Date.now() - startTime,
      });
      return;
    }

    // Proxy logic: use x-target-url header if provided, otherwise auto-detect
    // provider from the Host header or request path.
    let targetBase = req.headers["x-target-url"] as string | undefined;

    if (!targetBase) {
      // Try to detect provider from the Host header (e.g. api.openai.com)
      const host = req.headers["host"] ?? "";
      const hostUrl = `https://${host}${path}`;
      const detectedProvider = detectProvider(hostUrl);
      if (detectedProvider !== "unknown") {
        targetBase = getProviderBaseUrl(detectedProvider) ?? undefined;
      }
      // Fallback: try to detect from path patterns alone
      if (!targetBase) {
        const pathProvider = detectProvider(`https://placeholder${path}`);
        if (pathProvider !== "unknown") {
          targetBase = getProviderBaseUrl(pathProvider) ?? undefined;
        }
      }
      if (!targetBase) {
        sendJson(res, 400, {
          error:
            "Could not determine upstream provider. Set the Host header to a known provider (e.g. api.openai.com) or provide x-target-url header.",
        });
        return;
      }
    }

    // Build target URL: combine base with the request path
    const targetUrl = targetBase.replace(/\/+$/, "") + path;

    // Read the full request body
    let requestBody: Buffer;
    try {
      requestBody = await readRequestBody(req);
    } catch {
      sendJson(res, 502, { error: "Failed to read request body" });
      return;
    }

    // Build forwarded headers, removing proxy-specific ones
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "x-target-url" ||
        lowerKey === "host" ||
        lowerKey === "connection"
      ) {
        continue;
      }
      if (value !== undefined) {
        forwardHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    }

    const requestStart = Date.now();
    let providerResponse: Response;

    try {
      providerResponse = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body:
          method !== "GET" && method !== "HEAD"
            ? new Uint8Array(requestBody)
            : undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown fetch error";
      log.error(`Upstream request failed: ${message}`);
      sendJson(res, 502, { error: `Upstream request failed: ${message}` });
      return;
    }

    // Check if the response is an SSE stream
    const contentType = providerResponse.headers.get("content-type") ?? "";
    const isSSE = contentType.includes("text/event-stream");

    if (isSSE && providerResponse.body) {
      // ---------------------------------------------------------------
      // STREAMING PATH: pipe chunks through to client in real-time,
      // accumulate them for metric extraction after the stream ends.
      // ---------------------------------------------------------------
      const responseHeaders: Record<string, string> = {};
      providerResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      res.writeHead(providerResponse.status, responseHeaders);

      const chunks: Buffer[] = [];
      const reader = providerResponse.body.getReader();

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const buf = Buffer.from(value);
          chunks.push(buf);
          res.write(buf);
        }
      } catch (error) {
        log.error("Stream read error", { err: error instanceof Error ? error.message : String(error) });
      } finally {
        res.end();
      }

      const latencyMs = Date.now() - requestStart;
      const fullBody = Buffer.concat(chunks);

      try {
        extractStreamingMetrics(
          targetUrl,
          providerResponse.status,
          fullBody,
          latencyMs
        );
      } catch (error) {
        log.error("Streaming metric extraction error", { err: error instanceof Error ? error.message : String(error) });
      }
    } else {
      // ---------------------------------------------------------------
      // NON-STREAMING PATH: buffer full response, forward, extract.
      // ---------------------------------------------------------------
      let responseBodyBuffer: Buffer;
      try {
        const arrayBuffer = await providerResponse.arrayBuffer();
        responseBodyBuffer = Buffer.from(arrayBuffer);
      } catch {
        sendJson(res, 502, {
          error: "Failed to read upstream response body",
        });
        return;
      }

      const latencyMs = Date.now() - requestStart;

      // Forward status code and headers back to the client
      const responseHeaders: Record<string, string> = {};
      providerResponse.headers.forEach((value, key) => {
        // Skip transfer-encoding since we are sending the full body
        if (key.toLowerCase() === "transfer-encoding") return;
        responseHeaders[key] = value;
      });

      res.writeHead(providerResponse.status, responseHeaders);
      res.end(responseBodyBuffer);

      // After response is sent, extract metrics asynchronously
      try {
        extractAndQueueMetrics(
          targetUrl,
          providerResponse.status,
          responseBodyBuffer,
          latencyMs
        );
      } catch (error) {
        log.error("Metric extraction error", { err: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  function extractStreamingMetrics(
    targetUrl: string,
    statusCode: number,
    sseBody: Buffer,
    latencyMs: number
  ): void {
    const provider = detectProvider(targetUrl);

    if (provider === "unknown") {
      log.warn(`Unrecognized provider for URL: ${targetUrl} - skipping metric extraction`);
      return;
    }

    const sseText = sseBody.toString("utf-8");
    const parsed = parseSSEResponse(provider, sseText, statusCode);

    let model: string | null = null;
    let tokensIn: number | null = null;
    let tokensOut: number | null = null;
    let tokensTotal: number | null = null;
    let costUsd: number | null = null;

    if (parsed) {
      model = parsed.model;
      tokensIn = parsed.tokensIn;
      tokensOut = parsed.tokensOut;
      tokensTotal = parsed.tokensTotal;

      if (model && tokensIn != null && tokensOut != null) {
        costUsd = calculateCost(model, tokensIn, tokensOut);
      }
    }

    const event: AgentEvent = {
      agent_id: agentId,
      event_type: "llm_call",
      provider,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      tokens_total: tokensTotal,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status_code: statusCode,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: { streaming: "true" },
    };

    eventBuffer.add(event);
  }

  function extractAndQueueMetrics(
    targetUrl: string,
    statusCode: number,
    responseBody: Buffer,
    latencyMs: number
  ): void {
    const provider = detectProvider(targetUrl);

    if (provider === "unknown") {
      log.warn(`Unrecognized provider for URL: ${targetUrl} - skipping metric extraction`);
      return;
    }

    // Parse the response body as JSON
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(responseBody.toString("utf-8"));
    } catch {
      log.warn(`Could not parse response body as JSON for ${provider} - skipping metric extraction`);
      return;
    }

    const parsed = parseProviderResponse(provider, parsedBody, statusCode);
    if (!parsed) {
      log.warn(`No parser result for provider: ${provider}`);
      return;
    }

    // Calculate cost if we have the necessary token data
    let costUsd: number | null = null;
    if (parsed.model && parsed.tokensIn != null && parsed.tokensOut != null) {
      costUsd = calculateCost(parsed.model, parsed.tokensIn, parsed.tokensOut);
    }

    const event: AgentEvent = {
      agent_id: agentId,
      event_type: "llm_call",
      provider,
      model: parsed.model,
      tokens_in: parsed.tokensIn,
      tokens_out: parsed.tokensOut,
      tokens_total: parsed.tokensTotal,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status_code: statusCode,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: {},
    };

    eventBuffer.add(event);
  }

  server.listen(port);

  async function shutdown(): Promise<void> {
    await eventBuffer.shutdown();
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { server, shutdown };
}
