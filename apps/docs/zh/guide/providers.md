# Provider 金鑰管理

AgentTrace 可以代管你的 LLM provider API key，讓你的應用程式不需要知道金鑰。代理會自動為每個 provider 注入正確的 auth header。

## 在 Onboard 時設定

```bash
agenttrace onboard
```

Onboard 精靈會逐一詢問各 provider 的 API key。按 Enter 可跳過任何 provider。

## 用 CLI 管理

```bash
# 列出已設定的 provider
agenttrace providers list

# 設定或更新 provider key
agenttrace providers set openai sk-proj-...
agenttrace providers set anthropic sk-ant-...

# 移除 provider
agenttrace providers remove openai
```

## 支援的 Provider

| Provider | 注入的 Auth Header |
|----------|--------------------|
| `openai` | `Authorization: Bearer <key>` |
| `anthropic` | `x-api-key: <key>` |
| `google` | `x-goog-api-key: <key>` |
| `mistral` | `Authorization: Bearer <key>` |
| `cohere` | `Authorization: Bearer <key>` |

## 運作原理

1. 透過 `agenttrace providers set` 或 `agenttrace onboard` 設定 API key
2. 金鑰存在 `~/.agenttrace/config.json`
3. `agenttrace start` 啟動時，金鑰傳給代理
4. 每次請求，代理偵測 provider 後注入對應的 auth header
5. 如果 client 已經帶了自己的 auth header，代理**不會**覆蓋

這代表你的應用程式可以不帶任何 API key 送請求：

```bash
# 不需要 Authorization header — 代理會自動注入
curl http://localhost:4000/v1/chat/completions \
  -H "Host: api.openai.com" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

## 設定檔格式

金鑰存在 `~/.agenttrace/config.json`：

```json
{
  "token": "at_...",
  "providers": {
    "openai": {
      "apiKey": "sk-proj-...",
      "rateLimit": {
        "maxRequests": 100,
        "windowSeconds": 60
      }
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  }
}
```

## 速率限制

每個 provider 可以設定可選的速率限制。設定後，代理會執行滑動視窗限制，超過時回傳 `429 Too Many Requests` 和 `Retry-After` header。

在 onboard 時設定（例如 `100/60` 代表每 60 秒 100 次請求），或直接編輯設定檔。
