# 多 Agent 設定

當你在同一台機器上運行多個 AI Agent 時，可以共用同一個 AgentGazer Proxy，同時分開追蹤各 Agent 的用量。

## 問題

預設情況下，所有經過 Proxy 的請求都會歸到單一 Agent（啟動時用 `--agent-id` 設定的）。這對單一 Agent 沒問題，但當你：

- 運行多個 Agent（例如 coding assistant + research assistant）
- 想看每個 Agent 的成本明細
- 需要為每個 Agent 設定不同的告警規則

就會有問題。

## 解法 1：路徑式 Agent ID（推薦）

在 URL 路徑中包含 agent ID：

```typescript
// Coding assistant
const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/coding-assistant/openai/v1",
  apiKey: "dummy",
});

// Research assistant
const anthropic = new Anthropic({
  baseURL: "http://localhost:18900/agents/research-assistant/anthropic",
  apiKey: "dummy",
});
```

這種方式：
- 適用於任何 SDK（不需要自訂 header）
- Agent ID 在 logs 和 URL 中可見
- 首次請求時自動建立 Agent

## 解法 2：x-agent-id Header

在每個請求中加上 `x-agent-id` header 來識別是哪個 Agent 發出的：

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:18900/openai/v1",
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
  baseURL: "http://localhost:18900/openai/v1",
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
  baseURL: "http://localhost:18900/anthropic",
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
agentgazer start
```

不需要特殊參數 — `x-agent-id` header 會處理 Agent 識別。

## Dashboard 顯示

這樣設定後，AgentGazer Dashboard 會顯示：

- **Agents 頁面**：`coding-assistant` 和 `research-assistant` 作為獨立的 Agent 列出
- **各 Agent 統計**：每個 Agent 有自己的成本、Token 用量、延遲指標
- **告警**：可以為每個 Agent 設定不同的告警規則（例如 coding assistant 預算較高）

## 用 curl 測試

```bash
curl http://localhost:18900/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-agent-id: my-custom-agent" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

## Python 用法

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:18900/openai/v1",
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

## Agent ID 優先順序

當同時使用多種識別方式時，Proxy 依照以下優先順序：

| 優先順序 | 方式 | 範例 |
|----------|------|------|
| 1（最高） | `x-agent-id` header | `x-agent-id: my-agent` |
| 2 | 路徑前綴 | `/agents/my-agent/openai/...` |
| 3（最低） | 預設值 | 啟動時設定或 "default" |

## 何時使用哪種方式

| 情境 | 建議 |
|------|------|
| 單一 Agent | 不需要 agent ID — 使用預設值 |
| 多個 Agent，SDK 支援 header | 使用 `x-agent-id` header |
| 多個 Agent，SDK 不支援 header | 使用路徑式 `/agents/{id}/...` |
| OpenClaw（不支援自訂 header） | 使用路徑式 `/agents/{id}/...` |
| 測試不同的 prompt/設定 | 兩種方式皆可比較 |

## 限制

- **部分 SDK**：如果你的 SDK 不支援 `defaultHeaders`，改用路徑式方式。
