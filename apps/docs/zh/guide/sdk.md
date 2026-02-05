# SDK 使用指南

## 安裝

```bash
npm install @agenttrace/sdk
```

## 初始化

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",           // 必填：在 onboard 時產生的 Token
  agentId: "my-agent",            // 必填：此 Agent 的唯一識別碼
  endpoint: "http://localhost:8080/api/events",  // 選填：預設指向本地伺服器
});
```

> `apiKey` 和 `agentId` 為必填參數，缺少或僅含空白字元時會拋出錯誤。兩個值都會自動去除首尾空白。

## 追蹤 LLM 呼叫

```typescript
at.track({
  provider: "openai",           // LLM Provider 名稱
  model: "gpt-4o",              // 模型名稱
  tokens: {
    input: 500,                 // 輸入 token 數
    output: 200,                // 輸出 token 數
  },
  latency_ms: 1200,             // 延遲（毫秒）
  status: 200,                  // HTTP 狀態碼
});
```

## 發送心跳

定期呼叫 `heartbeat()` 表示 Agent 仍在運行：

```typescript
// 建議每 30 秒發送一次
const heartbeatTimer = setInterval(() => {
  at.heartbeat();
}, 30_000);
```

Agent 狀態判定規則：

- **Healthy**（健康）：最後心跳 < 2 分鐘前
- **Degraded**（降級）：最後心跳 2 ~ 10 分鐘前
- **Down**（離線）：最後心跳 > 10 分鐘前

## 回報錯誤

```typescript
try {
  await someOperation();
} catch (err) {
  at.error(err as Error);
  // Error 物件的 stack trace 會自動擷取
}
```

## 自定義事件

```typescript
at.custom({
  key: "value",
  task: "data-processing",
  items_processed: 42,
});
```

## Trace 與 Span

SDK 支援結構化的 Trace / Span 追蹤：

```typescript
const trace = at.startTrace();
const span = trace.startSpan("planning");
// ... 執行規劃邏輯 ...
span.end();

const execSpan = trace.startSpan("execution");
// ... 執行作業 ...
execSpan.end();
```

## 關閉（Graceful Shutdown）

```typescript
// 在程序退出前呼叫，確保所有暫存事件都已發送
await at.shutdown();
```

## 事件緩衝機制

SDK 採用批次發送策略以提升效率：

- 事件先暫存在記憶體 buffer 中
- 每 **5 秒**自動 flush 一次
- Buffer 達到 **50 筆**時立即 flush（以先到者為準）
- 硬性上限 **5000** 筆事件 — 丟棄前會先嘗試緊急 flush
- `maxBufferSize` 設為 0 或負數時會自動回退為預設值（50）
- 網路錯誤只會記錄 warning，**不會拋出例外**（不影響你的 Agent 運行）

## 完整範例

```typescript
import { AgentTrace } from "@agenttrace/sdk";
import OpenAI from "openai";

const at = AgentTrace.init({
  apiKey: process.env.AGENTTRACE_TOKEN!,
  agentId: "my-chatbot",
  endpoint: "http://localhost:8080/api/events",
});

const openai = new OpenAI();

// 定期發送心跳
setInterval(() => at.heartbeat(), 30_000);

async function chat(userMessage: string): Promise<string> {
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userMessage }],
    });

    at.track({
      provider: "openai",
      model: "gpt-4o",
      tokens: {
        input: response.usage?.prompt_tokens,
        output: response.usage?.completion_tokens,
      },
      latency_ms: Date.now() - start,
      status: 200,
    });

    return response.choices[0].message.content ?? "";
  } catch (err) {
    at.error(err as Error);
    throw err;
  }
}

// 程序結束前
process.on("SIGTERM", async () => {
  await at.shutdown();
  process.exit(0);
});
```
