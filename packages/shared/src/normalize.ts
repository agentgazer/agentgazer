/**
 * Prompt normalization for loop detection.
 * Normalizes prompts to detect semantic repetition even when dynamic values change.
 */

// Regex patterns for normalization
const PATTERNS = {
  // Numbers (integers and decimals)
  numbers: /\b\d+(\.\d+)?\b/g,
  // UUIDs (various formats)
  uuids: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  // ISO timestamps
  isoTimestamps: /\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?\b/g,
  // Common ID patterns (e.g., user_abc123, order-12345)
  idPatterns: /\b(id|user|order|session|request|msg|message|chat|thread)[_-]?[a-z0-9]+\b/gi,
  // Hex strings (likely hashes or IDs)
  hexStrings: /\b[0-9a-f]{16,}\b/gi,
  // Multiple whitespace
  whitespace: /\s+/g,
};

/**
 * Normalize a prompt for SimHash comparison.
 * Replaces dynamic values with placeholders to detect semantic repetition.
 */
export function normalizePrompt(text: string): string {
  let normalized = text;

  // Order matters: more specific patterns first
  normalized = normalized.replace(PATTERNS.uuids, "<ID>");
  normalized = normalized.replace(PATTERNS.isoTimestamps, "<TS>");
  normalized = normalized.replace(PATTERNS.hexStrings, "<ID>");
  normalized = normalized.replace(PATTERNS.idPatterns, "<ID>");
  normalized = normalized.replace(PATTERNS.numbers, "<NUM>");

  // Normalize whitespace and case
  normalized = normalized.replace(PATTERNS.whitespace, " ");
  normalized = normalized.toLowerCase().trim();

  return normalized;
}

/**
 * Message format compatible with OpenAI/Anthropic
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "function" | "tool";
  content?: string | null;
  name?: string;
  function_call?: unknown;
  tool_calls?: unknown[];
}

/**
 * Extract the last user message from a conversation.
 * For loop detection, we focus on what the user/agent is asking now.
 */
export function extractUserMessage(messages: ChatMessage[]): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "";
  }

  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user" && typeof msg.content === "string") {
      return msg.content;
    }
  }

  // Fallback: return last message content regardless of role
  const last = messages[messages.length - 1];
  if (typeof last.content === "string") {
    return last.content;
  }

  return "";
}

/**
 * Extract tool calls from a request body.
 * Returns array of tool call signatures for comparison.
 */
export function extractToolCalls(body: Record<string, unknown>): string[] {
  const tools: string[] = [];

  // OpenAI function calling format
  if (body.functions && Array.isArray(body.functions)) {
    for (const fn of body.functions) {
      if (typeof fn === "object" && fn !== null && "name" in fn) {
        tools.push(`fn:${(fn as { name: string }).name}`);
      }
    }
  }

  // OpenAI tools format
  if (body.tools && Array.isArray(body.tools)) {
    for (const tool of body.tools) {
      if (typeof tool === "object" && tool !== null) {
        const t = tool as { type?: string; function?: { name?: string } };
        if (t.type === "function" && t.function?.name) {
          tools.push(`fn:${t.function.name}`);
        }
      }
    }
  }

  // Anthropic tool_use format
  if (body.tool_choice && typeof body.tool_choice === "object") {
    const tc = body.tool_choice as { name?: string };
    if (tc.name) {
      tools.push(`tool:${tc.name}`);
    }
  }

  return tools;
}

/**
 * Extract and normalize prompt from request body.
 * Handles both OpenAI messages format and simple prompt format.
 */
export function extractAndNormalizePrompt(body: Record<string, unknown>): string {
  let rawPrompt = "";

  // OpenAI/Anthropic messages format
  if (body.messages && Array.isArray(body.messages)) {
    rawPrompt = extractUserMessage(body.messages as ChatMessage[]);
  }
  // Simple prompt format
  else if (typeof body.prompt === "string") {
    rawPrompt = body.prompt;
  }
  // Input format (some APIs)
  else if (typeof body.input === "string") {
    rawPrompt = body.input;
  }

  return normalizePrompt(rawPrompt);
}
