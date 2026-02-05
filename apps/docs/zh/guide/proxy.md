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

最簡單的方式是設定 `OPENAI_BASE_URL` 環境變數：

```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
```

或在程式碼中指定：

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/v1",  // 指向 Proxy
  // API Key 正常設定，Proxy 會透傳
});

// 正常使用，完全不需要其他改動
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

Proxy 會自動從路徑 `/v1/chat/completions` 偵測到是 OpenAI 請求。

### Anthropic SDK 整合範例

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:4000/anthropic",
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

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
