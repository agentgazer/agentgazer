# 快速開始

## 安裝

```bash
npm install -g agenttrace
```

需要 Node.js 18 以上。

## 首次設定

執行 onboard 指令來產生認證 token 並設定 provider API key：

```bash
agenttrace onboard
```

這會：

1. 在 `~/.agenttrace/config.json` 建立設定檔，包含自動產生的 token
2. 建立 SQLite 資料庫 `~/.agenttrace/agenttrace.db`
3. 引導你設定各 provider 的 API key（可選）

## 啟動

```bash
agenttrace start
```

這會啟動三個服務：

| 服務 | 預設 Port | 說明 |
|------|----------|------|
| API 伺服器 | 8080 | REST API + 儀表板 |
| LLM 代理 | 4000 | LLM 呼叫的透明代理 |
| 儀表板 | 8080 | Web UI（由 API 伺服器提供） |

開啟 `http://localhost:8080` 檢視儀表板。

### 選項

```bash
agenttrace start --port 9090          # 自訂伺服器 port
agenttrace start --proxy-port 5000    # 自訂代理 port
agenttrace start --retention-days 7   # 資料保留 7 天
agenttrace start --no-open            # 不自動開啟瀏覽器
```

## 連接你的 Agent

有兩種方式將資料送到 AgentTrace：

### 方式 A：使用代理（推薦）

將 LLM client 的 base URL 指向代理伺服器：

```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
```

代理會自動偵測 provider、轉送請求、記錄使用量指標。不需修改程式碼。

### 方式 B：使用 SDK

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

// 優雅關閉
await at.shutdown();
```

安裝 SDK：

```bash
npm install @agenttrace/sdk
```

## 檢視狀態

```bash
agenttrace status            # 顯示目前設定
agenttrace providers list    # 列出已設定的 provider
```

## 架構

```
你的 App ──> AgentTrace 代理 ──> LLM Provider (OpenAI, Anthropic 等)
                  │
                  ▼
            AgentTrace Server (Express + SQLite)
                  │
                  ▼
             儀表板 (React)
```

所有元件都在你的機器上運行。代理攔截 LLM 流量，擷取使用量資料（token 數、成本、延遲），送到本機的 server。儀表板從同一個 SQLite 資料庫讀取資料。
