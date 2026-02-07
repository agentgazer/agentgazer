import { describe, it, expect } from "vitest";
import {
  normalizePrompt,
  extractUserMessage,
  extractToolCalls,
  extractAndNormalizePrompt,
  type ChatMessage,
} from "../normalize.js";

describe("normalizePrompt", () => {
  it("replaces numbers with <num>", () => {
    expect(normalizePrompt("page 42 of 100")).toBe("page <num> of <num>");
    expect(normalizePrompt("retry 3")).toBe("retry <num>");
  });

  it("replaces UUIDs with <id>", () => {
    expect(normalizePrompt("id: 550e8400-e29b-41d4-a716-446655440000")).toBe(
      "id: <id>"
    );
    // "user" alone is kept since it doesn't match the ID pattern (needs suffix)
    expect(normalizePrompt("user a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "user <id>"
    );
    // user_xxx matches the ID pattern
    expect(normalizePrompt("user_test a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "<id> <id>"
    );
  });

  it("replaces ISO timestamps with <ts>", () => {
    expect(normalizePrompt("time: 2024-01-15T10:30:00Z")).toBe("time: <ts>");
    expect(normalizePrompt("created at 2024-01-15T10:30:00.123Z")).toBe(
      "created at <ts>"
    );
    expect(normalizePrompt("date 2024-01-15T10:30:00+05:00")).toBe("date <ts>");
  });

  it("normalizes whitespace", () => {
    expect(normalizePrompt("hello    world")).toBe("hello world");
    expect(normalizePrompt("  leading  and  trailing  ")).toBe(
      "leading and trailing"
    );
    expect(normalizePrompt("line1\n\n\nline2")).toBe("line1 line2");
  });

  it("converts to lowercase", () => {
    expect(normalizePrompt("HELLO World")).toBe("hello world");
    expect(normalizePrompt("CamelCase")).toBe("camelcase");
  });

  it("handles combined normalization", () => {
    // Note: "user" followed by a UUID gets matched as idPattern first for "user", then UUID
    const input = "ID 550e8400-e29b-41d4-a716-446655440000 at 2024-01-15T10:30:00Z made 5 requests";
    const result = normalizePrompt(input);
    expect(result).toContain("<id>");
    expect(result).toContain("<ts>");
    expect(result).toContain("<num>");
  });

  it("handles empty string", () => {
    expect(normalizePrompt("")).toBe("");
  });

  it("replaces hex strings with <id>", () => {
    expect(normalizePrompt("hash: 0123456789abcdef0123")).toBe("hash: <id>");
  });

  it("replaces common ID patterns", () => {
    expect(normalizePrompt("user_abc123")).toBe("<id>");
    expect(normalizePrompt("order-12345")).toBe("<id>");
    expect(normalizePrompt("session_xyz")).toBe("<id>");
  });
});

describe("extractUserMessage", () => {
  it("extracts content from last user message", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "What is the weather?" },
    ];
    expect(extractUserMessage(messages)).toBe("What is the weather?");
  });

  it("falls back to last message content if no user message", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "assistant", content: "Hello!" },
    ];
    // Falls back to last message content
    expect(extractUserMessage(messages)).toBe("Hello!");
  });

  it("handles empty array", () => {
    expect(extractUserMessage([])).toBe("");
  });

  it("returns empty for non-string content", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: null },
    ];
    expect(extractUserMessage(messages)).toBe("");
  });

  it("handles only user messages with string content", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Simple text" },
    ];
    expect(extractUserMessage(messages)).toBe("Simple text");
  });
});

describe("extractToolCalls", () => {
  it("extracts OpenAI functions format", () => {
    const body = {
      functions: [
        { name: "search" },
        { name: "calculate" },
      ],
    };
    expect(extractToolCalls(body)).toEqual(["fn:search", "fn:calculate"]);
  });

  it("extracts OpenAI tools format", () => {
    const body = {
      tools: [
        { type: "function", function: { name: "read_file" } },
        { type: "function", function: { name: "write_file" } },
      ],
    };
    expect(extractToolCalls(body)).toEqual(["fn:read_file", "fn:write_file"]);
  });

  it("extracts Anthropic tool_choice", () => {
    const body = {
      tool_choice: { name: "search_tool" },
    };
    expect(extractToolCalls(body)).toEqual(["tool:search_tool"]);
  });

  it("returns empty array when no tool calls", () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
    };
    expect(extractToolCalls(body)).toEqual([]);
  });

  it("returns empty array for empty body", () => {
    expect(extractToolCalls({})).toEqual([]);
  });

  it("handles missing messages array", () => {
    expect(extractToolCalls({ model: "gpt-4" })).toEqual([]);
  });
});

describe("extractAndNormalizePrompt", () => {
  it("extracts and normalizes user message from body", () => {
    const body = {
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "User 123 at 2024-01-15T10:00:00Z" },
      ],
    };
    const result = extractAndNormalizePrompt(body);
    expect(result).toContain("<num>");
    expect(result).toContain("<ts>");
  });

  it("handles prompt field (non-chat format)", () => {
    const body = {
      prompt: "Generate Code 42",
    };
    expect(extractAndNormalizePrompt(body)).toBe("generate code <num>");
  });

  it("prefers messages over prompt field", () => {
    const body = {
      messages: [{ role: "user", content: "from content" }],
      prompt: "from prompt field",
    };
    // "messages" gets replaced by the idPattern (msg prefix)
    expect(extractAndNormalizePrompt(body)).toBe("from content");
  });

  it("returns empty string for empty body", () => {
    expect(extractAndNormalizePrompt({})).toBe("");
  });

  it("handles input field", () => {
    const body = {
      input: "Some input text 123",
    };
    expect(extractAndNormalizePrompt(body)).toBe("some input text <num>");
  });
});
