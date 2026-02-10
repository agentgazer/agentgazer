# Format Converter Spec

## Purpose

Convert request/response formats between OpenAI and Anthropic APIs to enable cross-provider model override.

## Functions

### openaiToAnthropic(request: OpenAIRequest): AnthropicRequest

Converts OpenAI chat completion request to Anthropic messages format.

**Transformations:**
1. Extract `role: "system"` messages → `system` field (concatenate if multiple)
2. Filter out system messages from `messages` array
3. Ensure `max_tokens` is set (default: 4096)
4. Convert `tools` format: remove `strict` field from function definitions
5. Map `stop` → `stop_sequences`

### anthropicToOpenai(response: AnthropicResponse): OpenAIResponse

Converts Anthropic messages response to OpenAI chat completion format.

**Transformations:**
1. `content[].text` → `choices[0].message.content`
2. `stop_reason` → `finish_reason` mapping:
   - `end_turn` → `stop`
   - `max_tokens` → `length`
   - `stop_sequence` → `stop`
   - `tool_use` → `tool_calls`
3. `usage.input_tokens` → `usage.prompt_tokens`
4. `usage.output_tokens` → `usage.completion_tokens`
5. Add `id`, `object`, `created`, `model` fields

### anthropicSseToOpenaiSse(event: string, data: object): OpenAIChunk | null

Converts Anthropic SSE streaming events to OpenAI chunk format.

**Event mapping:**
- `message_start` → emit initial chunk with role
- `content_block_delta` → emit chunk with delta.content
- `message_delta` → capture usage, emit finish_reason
- `message_stop` → emit `[DONE]`

## Types

```typescript
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentPart[];
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAITool[];
}

interface AnthropicRequest {
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: AnthropicTool[];
}
```
