# 代理伺服器

AgentTrace 代理是一個透明的 HTTP proxy，位於你的應用程式和 LLM provider 之間。它將請求轉送到上游 API，即時串流回應，並擷取使用量指標（token 數、成本、延遲），不會修改任何內容。

## 運作原理

1. 你的 LLM client 將請求送到 `http://localhost:4000`，而非直接送到 provider
2. 代理從 `Host` header 或請求路徑偵測 provider
3. 如有設定，自動注入 provider 的 API key
4. 如有設定，執行 per-provider 的速率限制
5. 請求被轉送到真正的上游 API
6. 回應即時串流回你的 client
7. Token 數、模型、延遲、成本被擷取並暫存
8. 暫存的事件定期送到 AgentTrace server

同時支援標準 JSON 回應和 SSE 串流回應。

## 支援的 Provider

| Provider | Host | 偵測方式 |
|----------|------|---------|
| OpenAI | `api.openai.com` | 路徑 `/v1/chat/completions` 或 Host |
| Anthropic | `api.anthropic.com` | 路徑 `/v1/messages` 或 Host |
| Google | `generativelanguage.googleapis.com` | Host |
| Mistral | `api.mistral.ai` | Host |
| Cohere | `api.cohere.com` | Host |
| DeepSeek | `api.deepseek.com` | Host |
| Moonshot | `api.moonshot.cn` | Host |
| Zhipu (GLM) | `open.bigmodel.cn` | Host |
| MiniMax | `api.minimax.chat` | Host |
| Baichuan | `api.baichuan-ai.com` | Host |
| Yi (01.AI) | `api.lingyiwanwu.com` | Host |

## Provider 偵測

代理從 `Host` header 自動偵測目標 provider。將 LLM client 的 base URL 設為 `http://localhost:4000`，代理會處理路由。

如果自動偵測失敗，設定 `x-target-url` header 來明確指定上游 base URL：

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-..." \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

## API Key 注入

設定 provider key 後（透過 `agenttrace onboard` 或 `agenttrace providers set`），代理會自動注入正確的 auth header：

| Provider | Header |
|----------|--------|
| OpenAI, Mistral, Cohere, DeepSeek, Moonshot, Zhipu, MiniMax, Baichuan, Yi | `Authorization: Bearer <key>` |
| Anthropic | `x-api-key: <key>` |
| Google | `x-goog-api-key: <key>` |

如果 client 已經提供 auth header，代理**不會**覆蓋它。

## 速率限制

設定速率限制後，代理會對每個 provider 執行滑動視窗速率限制。超過限制的請求會收到 `429` 回應和 `Retry-After` header。

在 onboard 時設定，或直接編輯 `~/.agenttrace/config.json`：

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "rateLimit": { "maxRequests": 100, "windowSeconds": 60 }
    }
  }
}
```

## 健康檢查

```
GET http://localhost:4000/health
```

回應：

```json
{ "status": "ok", "agent_id": "proxy", "uptime_ms": 12345 }
```

## 獨立使用

代理可以獨立於 CLI 運行：

```bash
agenttrace-proxy --api-key <token> --agent-id proxy \
  --provider-keys '{"openai":"sk-..."}' \
  --rate-limits '{"openai":{"maxRequests":100,"windowSeconds":60}}'
```

或以程式方式：

```typescript
import { startProxy } from "@agenttrace/proxy";

const { server, shutdown } = startProxy({
  port: 4000,
  apiKey: "your-token",
  agentId: "proxy",
  endpoint: "http://localhost:8080/api/events",
  providerKeys: { openai: "sk-..." },
  rateLimits: { openai: { maxRequests: 100, windowSeconds: 60 } },
});
```

## 設定選項

| 選項 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `port` | `number` | `4000` | 代理監聽 port |
| `apiKey` | `string` | 必填 | AgentTrace server 的認證 token |
| `agentId` | `string` | 必填 | 記錄事件用的 Agent ID |
| `endpoint` | `string` | — | 事件接收 URL |
| `flushInterval` | `number` | `5000` | 暫存區刷新間隔（毫秒） |
| `maxBufferSize` | `number` | `50` | 自動刷新前的最大暫存事件數 |
| `providerKeys` | `Record<string, string>` | — | 要注入的 provider API key |
| `rateLimits` | `Record<string, RateLimitConfig>` | — | Per-provider 速率限制 |
