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

## Agent 識別

Proxy 支援多種方式識別發出請求的 Agent。

### 路徑式 Agent ID

在 URL 路徑中加入 agent ID，使用 `/agents/{agent-id}/` 格式：

```
http://localhost:4000/agents/my-bot/openai/v1/chat/completions
                      └─────────┘└────────────────────────────┘
                       Agent ID      Provider 路徑
```

OpenAI SDK 範例：

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:4000/agents/coding-assistant/openai/v1",
  apiKey: "dummy",
});
```

適用情境：
- SDK 不支援自訂 header
- 希望 agent ID 在 URL 中可見
- 使用 curl 或簡單的 HTTP 用戶端

### x-agent-id Header

使用 `x-agent-id` header 識別 Agent：

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "my-agent-name",
  },
});
```

### Agent ID 優先順序

當同時使用多種識別方式時，Proxy 依照以下優先順序：

| 優先順序 | 方式 | 範例 |
|----------|------|------|
| 1（最高） | `x-agent-id` header | `x-agent-id: my-agent` |
| 2 | 路徑前綴 | `/agents/my-agent/openai/...` |
| 3（最低） | 預設值 | 啟動時設定或 "default" |

### 自動建立 Agent

當 Proxy 收到不存在的 agent ID 請求時，會自動建立該 Agent 並套用預設政策設定。

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

## 政策執行

Proxy 在轉發請求前會檢查 Agent 政策。當政策阻擋請求時，Proxy 會回傳假的 LLM 回應，而不是轉發到 Provider。

### 政策檢查

| 政策 | 行為 |
|------|------|
| **Active** | 若 `active=false`，所有請求會被阻擋 |
| **Budget Limit** | 若當日花費 >= `budget_limit`，請求會被阻擋 |
| **Allowed Hours** | 若當前時間在 `allowed_hours_start` 到 `allowed_hours_end` 之外，請求會被阻擋 |

### 阻擋回應格式

被阻擋時，Proxy 會回傳符合 Provider 格式的有效回應：

**OpenAI 格式：**

```json
{
  "id": "blocked-...",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "[AgentTrace] Request blocked: budget_exceeded"
    },
    "finish_reason": "stop"
  }]
}
```

**Anthropic 格式：**

```json
{
  "id": "blocked-...",
  "type": "message",
  "content": [{
    "type": "text",
    "text": "[AgentTrace] Request blocked: agent_deactivated"
  }],
  "stop_reason": "end_turn"
}
```

### 阻擋原因

| 原因 | 說明 |
|------|------|
| `agent_deactivated` | Agent 的 `active` 設定為 `false` |
| `budget_exceeded` | 當日花費已達 `budget_limit` |
| `outside_allowed_hours` | 當前時間在允許區間之外 |

被阻擋的請求會被記錄為 `event_type: "blocked"` 的事件，阻擋原因會記錄在 tags 中。

## 頻率限制（Rate Limiting）

Proxy 會執行 Dashboard 中設定的 per-agent per-provider 頻率限制。當超過限制時，Proxy 回傳 `429 Too Many Requests` 回應。

### 運作方式

頻率限制使用**滑動窗口**演算法：

1. 記錄每個請求的時間戳
2. 新請求抵達時，移除超出窗口時間的舊時間戳
3. 若剩餘數量 >= 最大請求數，拒絕該請求
4. 回應包含 `retry_after_seconds`，計算自窗口中最舊請求何時過期

### 回應格式

被頻率限制時，Proxy 回傳符合 Provider 格式的錯誤回應：

**OpenAI 格式（大多數 Provider 通用）：**

```json
{
  "error": {
    "message": "Rate limit exceeded for agent \"my-bot\" on openai. Please retry after 45 seconds.",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  },
  "retry_after_seconds": 45
}
```

**Anthropic 格式：**

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded for agent \"my-bot\" on anthropic. Please retry after 45 seconds."
  },
  "retry_after_seconds": 45
}
```

HTTP Header 也會設定 `Retry-After`。

### 設定方式

頻率限制在 Dashboard 的 Agent Detail → Rate Limit Settings 區塊設定。詳見 [Dashboard 頻率限制設定](/zh/guide/dashboard#頻率限制設定-rate-limit-settings)。

### 阻擋原因

被頻率限制的請求會記錄阻擋原因 `rate_limited` 在事件 tags 中。

## 模型覆寫（Model Override）

Proxy 可以依據 Dashboard 設定的規則改寫請求中的模型。

### 運作方式

1. 請求抵達，帶有 `model: "gpt-4o"`
2. Proxy 檢查此 agent + provider 是否有覆寫規則
3. 若有規則（例如覆寫成 "gpt-4o-mini"），Proxy 改寫請求內容
4. 請求以 `model: "gpt-4o-mini"` 轉發
5. 事件同時記錄 `requested_model: "gpt-4o"` 和 `model: "gpt-4o-mini"`

### 使用情境

- **成本控制** — 不修改 Agent 程式碼，強制使用較便宜的模型
- **測試** — 比較不同模型的行為
- **快速回滾** — 出問題時快速切換模型

模型覆寫在 Dashboard 的 Agent Detail → Model Settings 區塊設定。

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
- 模型名稱（請求的與實際使用的）
- 延遲（毫秒）
- 成本（USD）
- HTTP 狀態碼

**Prompt 內容和 API Key 永遠不會傳送到 AgentTrace 伺服器。**
