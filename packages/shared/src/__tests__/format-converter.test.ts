import { describe, it, expect } from "vitest";
import {
  openaiToAnthropic,
  anthropicToOpenai,
  anthropicSseToOpenaiChunks,
  createStreamingConverterState,
  type OpenAIRequest,
  type AnthropicResponse,
  type AnthropicSSEEvent,
} from "../format-converter.js";

describe("openaiToAnthropic", () => {
  it("converts basic message", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [
        { role: "user", content: "Hello" },
      ],
      max_tokens: 100,
    };

    const result = openaiToAnthropic(request);

    expect(result.model).toBe("gpt-4");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(result.max_tokens).toBe(100);
    expect(result.system).toBeUndefined();
  });

  it("extracts system message to top-level field", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ],
    };

    const result = openaiToAnthropic(request);

    expect(result.system).toBe("You are a helpful assistant.");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
  });

  it("concatenates multiple system messages", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [
        { role: "system", content: "First instruction." },
        { role: "system", content: "Second instruction." },
        { role: "user", content: "Hello" },
      ],
    };

    const result = openaiToAnthropic(request);

    expect(result.system).toBe("First instruction.\n\nSecond instruction.");
  });

  it("defaults max_tokens to 4096 if not provided", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    };

    const result = openaiToAnthropic(request);

    expect(result.max_tokens).toBe(4096);
  });

  it("converts stop to stop_sequences", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      stop: ["END", "STOP"],
    };

    const result = openaiToAnthropic(request);

    expect(result.stop_sequences).toEqual(["END", "STOP"]);
  });

  it("converts single stop string to array", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      stop: "END",
    };

    const result = openaiToAnthropic(request);

    expect(result.stop_sequences).toEqual(["END"]);
  });

  it("converts tools format", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "What's the weather?" }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather info",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
            },
            strict: true, // Should be removed
          },
        },
      ],
    };

    const result = openaiToAnthropic(request);

    expect(result.tools).toHaveLength(1);
    expect(result.tools![0]).toEqual({
      name: "get_weather",
      description: "Get weather info",
      input_schema: {
        type: "object",
        properties: { city: { type: "string" } },
      },
    });
  });

  it("preserves temperature and top_p", () => {
    const request: OpenAIRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.7,
      top_p: 0.9,
    };

    const result = openaiToAnthropic(request);

    expect(result.temperature).toBe(0.7);
    expect(result.top_p).toBe(0.9);
  });
});

describe("anthropicToOpenai", () => {
  it("converts basic response", () => {
    const response: AnthropicResponse = {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3-sonnet",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const result = anthropicToOpenai(response);

    expect(result.id).toBe("msg_123");
    expect(result.object).toBe("chat.completion");
    expect(result.model).toBe("claude-3-sonnet");
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.content).toBe("Hello!");
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it("maps stop_reason correctly", () => {
    const makeResponse = (stop_reason: AnthropicResponse["stop_reason"]): AnthropicResponse => ({
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
      model: "claude-3-sonnet",
      stop_reason,
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    expect(anthropicToOpenai(makeResponse("end_turn")).choices[0].finish_reason).toBe("stop");
    expect(anthropicToOpenai(makeResponse("stop_sequence")).choices[0].finish_reason).toBe("stop");
    expect(anthropicToOpenai(makeResponse("max_tokens")).choices[0].finish_reason).toBe("length");
    expect(anthropicToOpenai(makeResponse("tool_use")).choices[0].finish_reason).toBe("tool_calls");
  });

  it("converts tool_use content blocks", () => {
    const response: AnthropicResponse = {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [
        { type: "text", text: "Let me check the weather." },
        {
          type: "tool_use",
          id: "call_123",
          name: "get_weather",
          input: { city: "Tokyo" },
        },
      ],
      model: "claude-3-sonnet",
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const result = anthropicToOpenai(response);

    expect(result.choices[0].message.content).toBe("Let me check the weather.");
    expect(result.choices[0].message.tool_calls).toHaveLength(1);
    expect(result.choices[0].message.tool_calls![0]).toEqual({
      id: "call_123",
      type: "function",
      function: {
        name: "get_weather",
        arguments: '{"city":"Tokyo"}',
      },
    });
    expect(result.choices[0].finish_reason).toBe("tool_calls");
  });

  it("uses requestModel if provided", () => {
    const response: AnthropicResponse = {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
      model: "claude-3-sonnet-20240229",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const result = anthropicToOpenai(response, "gpt-4");

    expect(result.model).toBe("gpt-4");
  });
});

describe("anthropicSseToOpenaiChunks", () => {
  it("converts message_start to role chunk", () => {
    const state = createStreamingConverterState();
    const event: AnthropicSSEEvent = {
      type: "message_start",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3-sonnet",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    };

    const chunks = anthropicSseToOpenaiChunks(event, state);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe("msg_123");
    expect(chunks[0].choices[0].delta.role).toBe("assistant");
    expect(state.messageId).toBe("msg_123");
    expect(state.inputTokens).toBe(10);
  });

  it("converts content_block_delta to content chunk", () => {
    const state = createStreamingConverterState();
    state.messageId = "msg_123";
    state.model = "claude-3-sonnet";

    const event: AnthropicSSEEvent = {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hello" },
    };

    const chunks = anthropicSseToOpenaiChunks(event, state);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta.content).toBe("Hello");
    expect(chunks[0].choices[0].finish_reason).toBeNull();
  });

  it("converts message_delta to finish chunk with usage", () => {
    const state = createStreamingConverterState();
    state.messageId = "msg_123";
    state.model = "claude-3-sonnet";
    state.inputTokens = 10;

    const event: AnthropicSSEEvent = {
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 15 },
    };

    const chunks = anthropicSseToOpenaiChunks(event, state);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].finish_reason).toBe("stop");
    expect(chunks[0].usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 15,
      total_tokens: 25,
    });
  });

  it("handles tool_use streaming", () => {
    const state = createStreamingConverterState();
    state.messageId = "msg_123";
    state.model = "claude-3-sonnet";

    // content_block_start for tool_use
    const startEvent: AnthropicSSEEvent = {
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "call_123", name: "get_weather", input: {} },
    };
    const startChunks = anthropicSseToOpenaiChunks(startEvent, state);

    expect(startChunks).toHaveLength(1);
    expect(startChunks[0].choices[0].delta.tool_calls).toBeDefined();
    expect(startChunks[0].choices[0].delta.tool_calls![0].id).toBe("call_123");
    expect(startChunks[0].choices[0].delta.tool_calls![0].function?.name).toBe("get_weather");

    // content_block_delta for tool input
    const deltaEvent: AnthropicSSEEvent = {
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: '{"city":' },
    };
    const deltaChunks = anthropicSseToOpenaiChunks(deltaEvent, state);

    expect(deltaChunks).toHaveLength(1);
    expect(deltaChunks[0].choices[0].delta.tool_calls![0].function?.arguments).toBe('{"city":');
  });
});
