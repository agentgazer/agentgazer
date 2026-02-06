# 多 Agent 設定

當你在同一台機器上運行多個 AI Agent 時，可以共用同一個 AgentTrace Proxy，同時分開追蹤各 Agent 的用量。

## 問題

預設情況下，所有經過 Proxy 的請求都會歸到單一 Agent（啟動時用 `--agent-id` 設定的）。這對單一 Agent 沒問題，但當你：

- 運行多個 Agent（例如 coding assistant + research assistant）
- 想看每個 Agent 的成本明細
- 需要為每個 Agent 設定不同的告警規則

就會有問題。

## 解法：x-agent-id Header

在每個請求中加上 `x-agent-id` header 來識別是哪個 Agent 發出的：

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "coding-assistant",
  },
});
```

每個 Agent 使用不同的 `x-agent-id` 值。Proxy 會把所有請求轉發到同一個 Provider，但分開記錄各 Agent 的指標。

## 範例：兩個 Agent 共用一個 Proxy

### Agent 1：Coding Assistant

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "coding-assistant",
  },
});

// 所有請求歸到 "coding-assistant"
await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a function..." }],
});
```

### Agent 2：Research Assistant

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:4000/anthropic",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "research-assistant",
  },
});

// 所有請求歸到 "research-assistant"
await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Summarize this paper..." }],
});
```

### 啟動 Proxy

```bash
agenttrace start
```

不需要特殊參數 — `x-agent-id` header 會處理 Agent 識別。

## Dashboard 顯示

這樣設定後，AgentTrace Dashboard 會顯示：

- **Agents 頁面**：`coding-assistant` 和 `research-assistant` 作為獨立的 Agent 列出
- **各 Agent 統計**：每個 Agent 有自己的成本、Token 用量、延遲指標
- **告警**：可以為每個 Agent 設定不同的告警規則（例如 coding assistant 預算較高）

## 用 curl 測試

```bash
curl http://localhost:4000/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-agent-id: my-custom-agent" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

## Python 用法

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:4000/openai/v1",
    api_key="dummy",
    default_headers={
        "x-agent-id": "python-agent",
    },
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## 回退行為

如果請求沒有 `x-agent-id` header，會使用 Proxy 的預設 agent ID：

| 情境 | 使用的 Agent ID |
|------|-----------------|
| 有 `x-agent-id: my-agent` header | `my-agent` |
| 沒有 header，啟動時用 `--agent-id foo` | `foo` |
| 沒有 header，沒有 `--agent-id` | 設定檔中的預設值 |

## 何時使用

| 情境 | 建議 |
|------|------|
| 單一 Agent（例如只有 OpenClaw） | 不需要 `x-agent-id` |
| 多個 Agent，同一個 Provider | 使用 `x-agent-id` |
| 多個 Agent，不同 Provider | 使用 `x-agent-id` |
| 測試不同的 prompt/設定 | 用 `x-agent-id` 來比較 |

## 限制

- **OpenClaw**：目前不支援自訂 header，所以無法在 OpenClaw 使用 `x-agent-id`。如果需要多個 OpenClaw Agent，請使用多個 Proxy 實例。
- **部分 SDK**：請確認你的 SDK 是否支援 `defaultHeaders` 或類似功能。
