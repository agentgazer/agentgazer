/**
 * Format converter for cross-provider model override.
 * Converts request/response formats between OpenAI and Anthropic APIs.
 */

// ---------------------------------------------------------------------------
// OpenAI Types
// ---------------------------------------------------------------------------

export interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: string };
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: "none" | "auto" | "required" | { type: "function"; function: { name: string } };
}

export interface OpenAIChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Anthropic Types
// ---------------------------------------------------------------------------

export interface AnthropicContentPart {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  source?: { type: "base64"; media_type: string; data: string };
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentPart[];
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicRequest {
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentPart[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Anthropic SSE Event Types
// ---------------------------------------------------------------------------

export interface AnthropicMessageStart {
  type: "message_start";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: [];
    model: string;
    stop_reason: null;
    stop_sequence: null;
    usage: { input_tokens: number; output_tokens: number };
  };
}

export interface AnthropicContentBlockStart {
  type: "content_block_start";
  index: number;
  content_block: { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
}

export interface AnthropicContentBlockDelta {
  type: "content_block_delta";
  index: number;
  delta: { type: "text_delta"; text: string } | { type: "input_json_delta"; partial_json: string };
}

export interface AnthropicContentBlockStop {
  type: "content_block_stop";
  index: number;
}

export interface AnthropicMessageDelta {
  type: "message_delta";
  delta: { stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" };
  usage: { output_tokens: number };
}

export interface AnthropicMessageStop {
  type: "message_stop";
}

export type AnthropicSSEEvent =
  | AnthropicMessageStart
  | AnthropicContentBlockStart
  | AnthropicContentBlockDelta
  | AnthropicContentBlockStop
  | AnthropicMessageDelta
  | AnthropicMessageStop;

// ---------------------------------------------------------------------------
// Conversion Functions
// ---------------------------------------------------------------------------

const DEFAULT_MAX_TOKENS = 4096;

/**
 * Convert OpenAI chat completion request to Anthropic messages format.
 */
export function openaiToAnthropic(request: OpenAIRequest): AnthropicRequest {
  const systemMessages: string[] = [];
  const messages: AnthropicMessage[] = [];

  for (const msg of request.messages) {
    if (msg.role === "system") {
      // Extract system messages to top-level system field
      const content = typeof msg.content === "string" ? msg.content : "";
      if (content) {
        systemMessages.push(content);
      }
    } else if (msg.role === "user" || msg.role === "assistant") {
      // Convert content format
      let content: string | AnthropicContentPart[];
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(convertOpenAIContentPartToAnthropic);
      } else {
        content = "";
      }

      // Handle tool calls in assistant messages
      if (msg.role === "assistant" && msg.tool_calls) {
        const parts: AnthropicContentPart[] = [];
        if (typeof content === "string" && content) {
          parts.push({ type: "text", text: content });
        } else if (Array.isArray(content)) {
          parts.push(...content);
        }
        for (const tc of msg.tool_calls) {
          parts.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || "{}"),
          });
        }
        messages.push({ role: "assistant", content: parts });
      } else {
        messages.push({ role: msg.role, content });
      }
    } else if (msg.role === "tool") {
      // Convert tool response to Anthropic format
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: msg.tool_call_id!,
          content: typeof msg.content === "string" ? msg.content : "",
        }],
      });
    }
  }

  const result: AnthropicRequest = {
    model: request.model,
    messages,
    max_tokens: request.max_tokens ?? DEFAULT_MAX_TOKENS,
  };

  if (systemMessages.length > 0) {
    result.system = systemMessages.join("\n\n");
  }

  if (request.temperature !== undefined) {
    result.temperature = request.temperature;
  }

  if (request.top_p !== undefined) {
    result.top_p = request.top_p;
  }

  if (request.stop) {
    result.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];
  }

  if (request.stream !== undefined) {
    result.stream = request.stream;
  }

  if (request.tools) {
    result.tools = request.tools.map(convertOpenAIToolToAnthropic);
  }

  if (request.tool_choice) {
    if (request.tool_choice === "none") {
      // Anthropic doesn't have "none", just omit tools
    } else if (request.tool_choice === "auto") {
      result.tool_choice = { type: "auto" };
    } else if (request.tool_choice === "required") {
      result.tool_choice = { type: "any" };
    } else if (typeof request.tool_choice === "object") {
      result.tool_choice = { type: "tool", name: request.tool_choice.function.name };
    }
  }

  return result;
}

function convertOpenAIContentPartToAnthropic(part: OpenAIContentPart): AnthropicContentPart {
  if (part.type === "text") {
    return { type: "text", text: part.text ?? "" };
  } else if (part.type === "image_url" && part.image_url) {
    // Convert URL to base64 if it's a data URL, otherwise not supported
    const url = part.image_url.url;
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        };
      }
    }
    // For HTTP URLs, Anthropic requires base64, so we can't convert directly
    // Return as text fallback
    return { type: "text", text: `[Image: ${url}]` };
  }
  return { type: "text", text: "" };
}

function convertOpenAIToolToAnthropic(tool: OpenAITool): AnthropicTool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters ?? { type: "object", properties: {} },
  };
}

/**
 * Convert Anthropic messages request to OpenAI chat completion format.
 * This is the reverse of openaiToAnthropic.
 */
export function anthropicToOpenaiRequest(request: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];

  // Convert system field to system message
  if (request.system) {
    messages.push({ role: "system", content: request.system });
  }

  // Convert messages
  for (const msg of request.messages) {
    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        messages.push({ role: "user", content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Check if it contains tool_result (should be converted to tool role)
        const toolResults = msg.content.filter(p => p.type === "tool_result");
        const otherParts = msg.content.filter(p => p.type !== "tool_result");

        // Add tool results as separate tool messages
        for (const tr of toolResults) {
          messages.push({
            role: "tool",
            content: tr.content ?? "",
            tool_call_id: tr.tool_use_id!,
          });
        }

        // Add other content as user message
        if (otherParts.length > 0) {
          const converted = otherParts.map(convertAnthropicContentPartToOpenAI);
          if (converted.length === 1 && converted[0].type === "text") {
            messages.push({ role: "user", content: converted[0].text ?? "" });
          } else {
            messages.push({ role: "user", content: converted });
          }
        }
      }
    } else if (msg.role === "assistant") {
      if (typeof msg.content === "string") {
        messages.push({ role: "assistant", content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const textParts: string[] = [];
        const toolCalls: OpenAIToolCall[] = [];

        for (const part of msg.content) {
          if (part.type === "text") {
            textParts.push(part.text ?? "");
          } else if (part.type === "tool_use") {
            toolCalls.push({
              id: part.id!,
              type: "function",
              function: {
                name: part.name!,
                arguments: JSON.stringify(part.input ?? {}),
              },
            });
          }
        }

        const assistantMsg: OpenAIMessage = {
          role: "assistant",
          content: textParts.join("") || null,
        };

        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls;
        }

        messages.push(assistantMsg);
      }
    }
  }

  const result: OpenAIRequest = {
    model: request.model,
    messages,
  };

  if (request.max_tokens !== undefined) {
    result.max_tokens = request.max_tokens;
  }

  if (request.temperature !== undefined) {
    result.temperature = request.temperature;
  }

  if (request.top_p !== undefined) {
    result.top_p = request.top_p;
  }

  if (request.stop_sequences) {
    result.stop = request.stop_sequences;
  }

  if (request.stream !== undefined) {
    result.stream = request.stream;
  }

  if (request.tools) {
    result.tools = request.tools.map(convertAnthropicToolToOpenAI);
  }

  if (request.tool_choice) {
    if (request.tool_choice.type === "auto") {
      result.tool_choice = "auto";
    } else if (request.tool_choice.type === "any") {
      result.tool_choice = "required";
    } else if (request.tool_choice.type === "tool" && request.tool_choice.name) {
      result.tool_choice = { type: "function", function: { name: request.tool_choice.name } };
    }
  }

  return result;
}

function convertAnthropicContentPartToOpenAI(part: AnthropicContentPart): OpenAIContentPart {
  if (part.type === "text") {
    return { type: "text", text: part.text ?? "" };
  } else if (part.type === "image" && part.source) {
    // Convert base64 to data URL
    const dataUrl = `data:${part.source.media_type};base64,${part.source.data}`;
    return { type: "image_url", image_url: { url: dataUrl } };
  }
  return { type: "text", text: "" };
}

function convertAnthropicToolToOpenAI(tool: AnthropicTool): OpenAITool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

/**
 * Convert OpenAI chat completion response to Anthropic messages format.
 * This is the reverse of anthropicToOpenai.
 */
export function openaiToAnthropicResponse(response: OpenAIResponse, requestModel?: string): AnthropicResponse {
  const content: AnthropicContentPart[] = [];

  if (response.choices && response.choices.length > 0) {
    const choice = response.choices[0];
    const msg = choice.message;

    // Convert text content
    if (msg.content) {
      content.push({ type: "text", text: msg.content });
    }

    // Convert tool calls
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}"),
        });
      }
    }
  }

  // If no content, add empty text
  if (content.length === 0) {
    content.push({ type: "text", text: "" });
  }

  const stopReason = mapOpenAIFinishReason(response.choices?.[0]?.finish_reason);

  return {
    id: response.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model: requestModel ?? response.model,
    stop_reason: stopReason,
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

function mapOpenAIFinishReason(
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null | undefined
): "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null {
  switch (finishReason) {
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "tool_calls":
      return "tool_use";
    default:
      return null;
  }
}

/**
 * Convert Anthropic messages response to OpenAI chat completion format.
 */
export function anthropicToOpenai(response: AnthropicResponse, requestModel?: string): OpenAIResponse {
  let textContent = "";
  const toolCalls: OpenAIToolCall[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      textContent += block.text ?? "";
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id!,
        type: "function",
        function: {
          name: block.name!,
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }

  const finishReason = mapAnthropicStopReason(response.stop_reason);

  const choice: OpenAIChoice = {
    index: 0,
    message: {
      role: "assistant",
      content: textContent || null,
    },
    finish_reason: finishReason,
  };

  if (toolCalls.length > 0) {
    choice.message.tool_calls = toolCalls;
  }

  return {
    id: response.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestModel ?? response.model,
    choices: [choice],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

function mapAnthropicStopReason(
  stopReason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null
): "stop" | "length" | "tool_calls" | null {
  switch (stopReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Streaming Conversion State
// ---------------------------------------------------------------------------

export interface StreamingConverterState {
  messageId: string;
  model: string;
  created: number;
  inputTokens: number;
  outputTokens: number;
  currentContentIndex: number;
  toolCallsInProgress: Map<number, { id: string; name: string; arguments: string }>;
}

export function createStreamingConverterState(): StreamingConverterState {
  return {
    messageId: "",
    model: "",
    created: Math.floor(Date.now() / 1000),
    inputTokens: 0,
    outputTokens: 0,
    currentContentIndex: 0,
    toolCallsInProgress: new Map(),
  };
}

/**
 * Convert Anthropic SSE event to OpenAI stream chunk(s).
 * Returns array of chunks (may be empty, one, or multiple).
 */
export function anthropicSseToOpenaiChunks(
  event: AnthropicSSEEvent,
  state: StreamingConverterState,
  requestModel?: string,
): OpenAIStreamChunk[] {
  const chunks: OpenAIStreamChunk[] = [];

  switch (event.type) {
    case "message_start":
      state.messageId = event.message.id;
      state.model = requestModel ?? event.message.model;
      state.inputTokens = event.message.usage.input_tokens;
      // Emit initial chunk with role
      chunks.push({
        id: state.messageId,
        object: "chat.completion.chunk",
        created: state.created,
        model: state.model,
        choices: [{
          index: 0,
          delta: { role: "assistant" },
          finish_reason: null,
        }],
      });
      break;

    case "content_block_start":
      state.currentContentIndex = event.index;
      if (event.content_block.type === "tool_use") {
        const tc = event.content_block;
        state.toolCallsInProgress.set(event.index, {
          id: tc.id,
          name: tc.name,
          arguments: "",
        });
        // Emit tool call start
        chunks.push({
          id: state.messageId,
          object: "chat.completion.chunk",
          created: state.created,
          model: state.model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: event.index,
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: "" },
              }],
            },
            finish_reason: null,
          }],
        });
      }
      break;

    case "content_block_delta":
      if (event.delta.type === "text_delta") {
        chunks.push({
          id: state.messageId,
          object: "chat.completion.chunk",
          created: state.created,
          model: state.model,
          choices: [{
            index: 0,
            delta: { content: event.delta.text },
            finish_reason: null,
          }],
        });
      } else if (event.delta.type === "input_json_delta") {
        const tc = state.toolCallsInProgress.get(event.index);
        if (tc) {
          tc.arguments += event.delta.partial_json;
          chunks.push({
            id: state.messageId,
            object: "chat.completion.chunk",
            created: state.created,
            model: state.model,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: event.index,
                  function: { arguments: event.delta.partial_json },
                }],
              },
              finish_reason: null,
            }],
          });
        }
      }
      break;

    case "content_block_stop":
      // No action needed
      break;

    case "message_delta":
      state.outputTokens = event.usage.output_tokens;
      const finishReason = mapAnthropicStopReason(event.delta.stop_reason);
      chunks.push({
        id: state.messageId,
        object: "chat.completion.chunk",
        created: state.created,
        model: state.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: finishReason,
        }],
        usage: {
          prompt_tokens: state.inputTokens,
          completion_tokens: state.outputTokens,
          total_tokens: state.inputTokens + state.outputTokens,
        },
      });
      break;

    case "message_stop":
      // Stream complete, no chunk needed (already sent finish_reason in message_delta)
      break;
  }

  return chunks;
}

/**
 * Parse Anthropic SSE line and return event object.
 */
export function parseAnthropicSSELine(eventType: string, data: string): AnthropicSSEEvent | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === eventType) {
      return parsed as AnthropicSSEEvent;
    }
    return parsed as AnthropicSSEEvent;
  } catch {
    return null;
  }
}

/**
 * Format OpenAI stream chunk as SSE line.
 */
export function formatOpenAISSELine(chunk: OpenAIStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Format SSE done marker.
 */
export function formatOpenAISSEDone(): string {
  return "data: [DONE]\n\n";
}

// ---------------------------------------------------------------------------
// OpenAI → Anthropic Streaming Conversion
// ---------------------------------------------------------------------------

export interface OpenAIToAnthropicStreamState {
  messageId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  sentMessageStart: boolean;
  sentMessageStop: boolean;
  contentBlockIndex: number;
  contentBlockStarted: boolean;
  // Map from OpenAI tool_call index to { anthropicBlockIndex, id, name, arguments }
  toolCallsInProgress: Map<number, { anthropicBlockIndex: number; id: string; name: string; arguments: string }>;
}

export function createOpenAIToAnthropicStreamState(): OpenAIToAnthropicStreamState {
  return {
    messageId: `msg_${Date.now()}`,
    model: "",
    inputTokens: 0,
    outputTokens: 0,
    sentMessageStart: false,
    sentMessageStop: false,
    contentBlockIndex: 0,
    contentBlockStarted: false,
    toolCallsInProgress: new Map(),
  };
}

/**
 * Convert OpenAI stream chunk to Anthropic SSE event(s).
 * Returns array of SSE lines (formatted strings ready to send).
 */
export function openaiChunkToAnthropicSse(
  chunk: OpenAIStreamChunk,
  state: OpenAIToAnthropicStreamState,
  requestModel?: string,
): string[] {
  const lines: string[] = [];

  // Track model
  if (chunk.model && !state.model) {
    state.model = requestModel ?? chunk.model;
  }

  // Send message_start on first chunk
  if (!state.sentMessageStart) {
    state.messageId = chunk.id || state.messageId;
    const messageStart: AnthropicMessageStart = {
      type: "message_start",
      message: {
        id: state.messageId,
        type: "message",
        role: "assistant",
        content: [],
        model: state.model || "unknown",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    };
    lines.push(formatAnthropicSSELine("message_start", messageStart));
    state.sentMessageStart = true;
  }

  if (chunk.choices && chunk.choices.length > 0) {
    const choice = chunk.choices[0];
    const delta = choice.delta;

    // Handle text content
    if (delta.content) {
      // Start content block if not started
      if (!state.contentBlockStarted) {
        const blockStart: AnthropicContentBlockStart = {
          type: "content_block_start",
          index: state.contentBlockIndex,
          content_block: { type: "text", text: "" },
        };
        lines.push(formatAnthropicSSELine("content_block_start", blockStart));
        state.contentBlockStarted = true;
      }

      // Send text delta
      const textDelta: AnthropicContentBlockDelta = {
        type: "content_block_delta",
        index: state.contentBlockIndex,
        delta: { type: "text_delta", text: delta.content },
      };
      lines.push(formatAnthropicSSELine("content_block_delta", textDelta));
    }

    // Handle tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const tcIndex = tc.index ?? 0;
        const existing = state.toolCallsInProgress.get(tcIndex);

        if (tc.id && tc.function?.name) {
          // New tool call starting
          // Close previous content block if open (text or previous tool call)
          if (state.contentBlockStarted) {
            const blockStop: AnthropicContentBlockStop = {
              type: "content_block_stop",
              index: state.contentBlockIndex,
            };
            lines.push(formatAnthropicSSELine("content_block_stop", blockStop));
            state.contentBlockIndex++;
            state.contentBlockStarted = false;
          }

          // Store the tool call with its Anthropic content block index
          const anthropicBlockIndex = state.contentBlockIndex;
          state.toolCallsInProgress.set(tcIndex, {
            anthropicBlockIndex,
            id: tc.id,
            name: tc.function.name,
            arguments: "",
          });

          // Start the tool_use content block
          const blockStart: AnthropicContentBlockStart = {
            type: "content_block_start",
            index: anthropicBlockIndex,
            content_block: { type: "tool_use", id: tc.id, name: tc.function.name, input: {} },
          };
          lines.push(formatAnthropicSSELine("content_block_start", blockStart));

          // Increment for next content block
          state.contentBlockIndex++;

          // If arguments are also present in the same chunk, emit them
          if (tc.function.arguments) {
            const toolCall = state.toolCallsInProgress.get(tcIndex)!;
            toolCall.arguments += tc.function.arguments;
            const inputDelta: AnthropicContentBlockDelta = {
              type: "content_block_delta",
              index: anthropicBlockIndex,
              delta: { type: "input_json_delta", partial_json: tc.function.arguments },
            };
            lines.push(formatAnthropicSSELine("content_block_delta", inputDelta));
          }
        } else if (tc.function?.arguments && existing) {
          // Tool call argument delta (continuing an existing tool call)
          existing.arguments += tc.function.arguments;
          const inputDelta: AnthropicContentBlockDelta = {
            type: "content_block_delta",
            index: existing.anthropicBlockIndex,
            delta: { type: "input_json_delta", partial_json: tc.function.arguments },
          };
          lines.push(formatAnthropicSSELine("content_block_delta", inputDelta));
        }
      }
    }

    // Handle finish
    if (choice.finish_reason) {
      // Close any open text content block
      // Note: for text blocks, contentBlockIndex points to the current block (we don't increment until a new block starts)
      if (state.contentBlockStarted) {
        const blockStop: AnthropicContentBlockStop = {
          type: "content_block_stop",
          index: state.contentBlockIndex,
        };
        lines.push(formatAnthropicSSELine("content_block_stop", blockStop));
        state.contentBlockStarted = false;
      }

      // Close all open tool call blocks
      for (const [, toolCall] of state.toolCallsInProgress) {
        const blockStop: AnthropicContentBlockStop = {
          type: "content_block_stop",
          index: toolCall.anthropicBlockIndex,
        };
        lines.push(formatAnthropicSSELine("content_block_stop", blockStop));
      }
      state.toolCallsInProgress.clear();

      // Track usage if available
      if (chunk.usage) {
        state.inputTokens = chunk.usage.prompt_tokens;
        state.outputTokens = chunk.usage.completion_tokens;
      }

      const stopReason = mapOpenAIFinishReasonToAnthropic(choice.finish_reason);
      const messageDelta: AnthropicMessageDelta = {
        type: "message_delta",
        delta: { stop_reason: stopReason },
        usage: { output_tokens: state.outputTokens },
      };
      lines.push(formatAnthropicSSELine("message_delta", messageDelta));

      const messageStop: AnthropicMessageStop = { type: "message_stop" };
      lines.push(formatAnthropicSSELine("message_stop", messageStop));
      state.sentMessageStop = true;
    }
  }

  return lines;
}

function mapOpenAIFinishReasonToAnthropic(
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null
): "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" {
  switch (finishReason) {
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "tool_calls":
      return "tool_use";
    default:
      return "end_turn";
  }
}

/**
 * Format Anthropic SSE event as SSE line.
 */
export function formatAnthropicSSELine(eventType: string, data: object): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Finalize an OpenAI to Anthropic stream conversion.
 * This ensures message_stop is sent even if the OpenAI stream ended unexpectedly.
 * Returns SSE lines to close the stream properly.
 */
export function finalizeOpenAIToAnthropicStream(
  state: OpenAIToAnthropicStreamState,
): string[] {
  const lines: string[] = [];

  // If message_start was never sent, there's nothing to finalize
  if (!state.sentMessageStart) {
    return lines;
  }

  // If message_stop was already sent, don't send duplicate
  if (state.sentMessageStop) {
    return lines;
  }

  // Close any open content block
  if (state.contentBlockStarted) {
    const blockStop: AnthropicContentBlockStop = {
      type: "content_block_stop",
      index: state.contentBlockIndex,
    };
    lines.push(formatAnthropicSSELine("content_block_stop", blockStop));
    state.contentBlockStarted = false;
  }

  // Close all open tool call blocks
  for (const [, toolCall] of state.toolCallsInProgress) {
    const blockStop: AnthropicContentBlockStop = {
      type: "content_block_stop",
      index: toolCall.anthropicBlockIndex,
    };
    lines.push(formatAnthropicSSELine("content_block_stop", blockStop));
  }
  state.toolCallsInProgress.clear();

  // Send message_delta with end_turn and message_stop
  const messageDelta: AnthropicMessageDelta = {
    type: "message_delta",
    delta: { stop_reason: "end_turn" },
    usage: { output_tokens: state.outputTokens },
  };
  lines.push(formatAnthropicSSELine("message_delta", messageDelta));

  const messageStop: AnthropicMessageStop = { type: "message_stop" };
  lines.push(formatAnthropicSSELine("message_stop", messageStop));
  state.sentMessageStop = true;

  return lines;
}

/**
 * Check if the OpenAI to Anthropic stream has been properly finalized.
 */
export function isOpenAIToAnthropicStreamFinalized(
  state: OpenAIToAnthropicStreamState,
): boolean {
  // If we never started, we're done
  if (!state.sentMessageStart) return true;

  // Check if message_stop was already sent
  return state.sentMessageStop;
}
