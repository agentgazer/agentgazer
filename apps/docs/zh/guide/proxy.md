# 代理伺服器

Proxy 是一個本地 HTTP 代理，透明地攔截你的 AI Agent 對 LLM Provider 的請求，自動提取 token 用量、延遲、成本等指標，**無需修改任何現有程式碼**。

## 路徑前綴路由（推薦）

Proxy 支援路徑前綴路由，將請求自動轉發到對應的 Provider：

| 路徑前綴 | 目標 |
|----------|------|
| `/openai/...` | `https://api.openai.com` |
| `/anthropic/...` | `https://api.anthropic.com` |
| `/google/...` | `https://generativelanguage.googleapis.com` |
| `/cohere/...` | `https://api.cohere.ai` |
| `/mistral/...` | `https://api.mistral.ai` |
| `/deepseek/...` | `https://api.deepseek.com` |

### OpenAI SDK 整合範例

**方式 A：使用儲存的 API Key（推薦）**

如果你已經用 `agenttrace providers set openai <key>` 儲存了 API Key，使用路徑前綴讓 Proxy 自動注入：

```bash
export OPENAI_BASE_URL=http://localhost:4000/openai/v1
```

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",  // 任意值，會被 Proxy 覆蓋
});
```

**方式 B：自己提供 API Key**

如果你想用自己的 API Key（不使用儲存的金鑰）：

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/v1",
  apiKey: process.env.OPENAI_API_KEY,  // 必須自己提供
});
```

Proxy 會從路徑 `/v1/chat/completions` 偵測到是 OpenAI 請求並透傳你的 Key。

### Anthropic SDK 整合範例

使用路徑前綴 `/anthropic`，Proxy 會自動注入儲存的 API Key：

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:4000/anthropic",
  apiKey: "dummy",  // 任意值，會被 Proxy 覆蓋
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

> 若要自己提供 API Key，設定 `apiKey` 並確保不使用路徑前綴（但此情況下無法自動注入）。

## 多 Agent 追蹤：x-agent-id

當多個 Agent 共用同一個 Proxy 時，用 `x-agent-id` header 區分各 Agent 的用量：

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "my-agent-name",
  },
});
```

若不設定此 header，所有請求會使用 Proxy 啟動時指定的預設 agent ID（`--agent-id`）。

## 使用 x-target-url Header

若路徑前綴路由無法滿足需求，可使用 `x-target-url` header 明確指定目標：

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

## Provider 偵測優先順序

Proxy 使用以下順序偵測目標 Provider：

1. **路徑前綴** — 如 `/openai/...`、`/anthropic/...`
2. **Host Header** — 如 `Host: api.openai.com`
3. **路徑模式** — 如 `/v1/chat/completions` 對應 OpenAI
4. **x-target-url Header** — 手動指定目標 URL

## 串流支援

Proxy 同時支援串流（SSE, Server-Sent Events）與非串流回應。串流模式下，Proxy 會在串流結束後非同步地解析並擷取指標。

## 健康檢查

```bash
curl http://localhost:4000/health
```

回傳：

```json
{
  "status": "ok",
  "agent_id": "my-agent",
  "uptime_ms": 123456
}
```

## 隱私保證

Proxy 只提取以下指標資料：

- Token 數量（輸入/輸出/合計）
- 模型名稱
- 延遲（毫秒）
- 成本（USD）
- HTTP 狀態碼

**Prompt 內容和 API Key 永遠不會傳送到 AgentTrace 伺服器。**
