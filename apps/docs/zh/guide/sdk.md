# SDK

AgentTrace SDK 讓你在程式碼中追蹤 LLM 呼叫、錯誤和自訂事件。它在本機暫存事件，定期送到 AgentTrace server。

## 安裝

```bash
npm install @agenttrace/sdk
```

## 快速開始

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",     // 來自 ~/.agenttrace/config.json
  agentId: "my-agent",
});

// 追蹤一次 LLM 呼叫
at.track({
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 150, output: 50 },
  latency_ms: 1200,
  status: 200,
});
```

## 初始化

```typescript
const at = AgentTrace.init({
  apiKey: string;            // 必填 — 認證 token
  agentId: string;           // 必填 — 識別此 agent
  endpoint?: string;         // 預設: http://localhost:8080/api/events
  flushInterval?: number;    // 預設: 5000（毫秒）
  maxBufferSize?: number;    // 預設: 50 個事件
});
```

## 追蹤方法

### `track(options)`

記錄一次 LLM 呼叫或完成事件。

```typescript
at.track({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  tokens: { input: 200, output: 100 },
  latency_ms: 800,
  status: 200,
  tags: { workflow: "summarize" },
});
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `provider` | `string` | Provider 名稱 (openai, anthropic 等) |
| `model` | `string` | 模型識別碼 |
| `tokens` | `{ input?, output?, total? }` | Token 計數 |
| `latency_ms` | `number` | 請求耗時（毫秒） |
| `status` | `number` | HTTP 狀態碼 |
| `tags` | `Record<string, unknown>` | 自訂中繼資料 |
| `error_message` | `string` | 失敗時的錯誤描述 |
| `trace_id` | `string` | 分散式追蹤 ID |
| `span_id` | `string` | Span ID |
| `parent_span_id` | `string` | 父 Span ID |

### `heartbeat()`

送出心跳信號。Server 用心跳來判斷 agent 健康狀態（healthy / degraded / down）。

```typescript
// 定期送出心跳
setInterval(() => at.heartbeat(), 30_000);
```

### `error(err)`

記錄錯誤事件。

```typescript
try {
  await callLLM();
} catch (err) {
  at.error(err);
}
```

### `custom(data)`

記錄自訂事件。

```typescript
at.custom({ action: "tool_call", tool: "web_search", query: "..." });
```

## 追蹤（Tracing）

SDK 支援分散式追蹤，包含 trace 和 span：

```typescript
const trace = at.startTrace();

const span = trace.startSpan("summarize");
// ... 執行工作 ...

const childSpan = span.startSpan("call-llm");
at.track({
  trace_id: childSpan.traceId,
  span_id: childSpan.spanId,
  parent_span_id: childSpan.parentSpanId,
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 100, output: 50 },
  latency_ms: 500,
  status: 200,
});
```

## 生命週期

### `flush()`

手動將暫存的事件送到 server。

```typescript
await at.flush();
```

### `shutdown()`

送出剩餘事件並停止 SDK。

```typescript
await at.shutdown();
```

在程式結束前呼叫此方法，確保所有事件都被送出。

## 成本計算

AgentTrace 會自動計算已知模型的成本（當有指定 `provider` 和 `model` 時）。支援的模型包括：

- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini, o3-mini
- **Anthropic**: claude-opus-4-20250514, claude-sonnet-4-20250514, claude-3-5-haiku-20241022
- **Google**: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
- **Mistral**: mistral-large-latest, mistral-small-latest, codestral-latest
- **Cohere**: command-r-plus, command-r
