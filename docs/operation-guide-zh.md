# AgentTrace 操作指南

> 本地優先的 AI Agent 可觀測性平台 — 完整安裝、設定與使用手冊

---

## 目錄

1. [平台概覽](#1-平台概覽)
2. [系統架構](#2-系統架構)
3. [安裝與快速開始](#3-安裝與快速開始)
4. [CLI 指令參考](#4-cli-指令參考)
5. [Proxy 代理伺服器](#5-proxy-代理伺服器)
6. [SDK 使用指南](#6-sdk-使用指南)
7. [Dashboard 儀表板](#7-dashboard-儀表板)
8. [告警系統](#8-告警系統)
9. [Provider 金鑰管理](#9-provider-金鑰管理)
10. [API 參考](#10-api-參考)
11. [Docker 部署](#11-docker-部署)
12. [環境變數](#12-環境變數)
13. [常見問題排除](#13-常見問題排除)
14. [附錄：快速啟動檢查表](#14-附錄快速啟動檢查表)

---

## 1. 平台概覽

AgentTrace 是一個**本地優先**的 AI Agent 可觀測性平台。只需一條指令 `npx agenttrace` 即可啟動一切：Express 伺服器、LLM 代理、React 儀表板，全部資料儲存於本機 SQLite，無需任何雲端依賴。

### 核心功能

- **LLM 呼叫監控**：追蹤每個 Agent 的 LLM 請求、延遲、token 用量
- **成本追蹤**：按 Provider / Model 分類的花費分析，支援每日預算告警
- **健康偵測**：基於心跳（heartbeat）機制自動判定 Agent 狀態（healthy / degraded / down）
- **告警通知**：支援 Agent 下線、錯誤率閾值、預算超標等規則，透過 Webhook 或 Email 發送
- **隱私優先**：Prompt 內容和 API Key 永遠不會離開使用者的機器

### 資料收集方式

| 方式 | 說明 | 適用場景 |
|------|------|----------|
| **Proxy**（推薦） | 透明代理攔截 LLM 請求，零程式碼改動 | 無需修改現有程式碼，自動收集所有 LLM 呼叫 |
| **SDK** | 在程式碼中手動埋點追蹤 | 需要精確控制要追蹤哪些呼叫，或自訂事件 |

### 支援的 LLM Provider

| Provider | Host Pattern | 路徑偵測 |
|----------|-------------|----------|
| OpenAI | `api.openai.com` | `/v1/chat/completions`, `/v1/completions` |
| Anthropic | `api.anthropic.com` | `/v1/messages` |
| Google | `generativelanguage.googleapis.com` | Host 比對 |
| Mistral | `api.mistral.ai` | Host 比對 |
| Cohere | `api.cohere.com` | Host 比對 |
| DeepSeek | `api.deepseek.com` | Host 比對 |

---

## 2. 系統架構

### 架構總覽

```
┌─────────────────────────────────────────────────────────────────┐
│                        使用者的機器                              │
│                                                                 │
│  ┌──────────┐    ┌────────────────────┐                         │
│  │ AI Agent │───>│ AgentTrace Proxy   │──> LLM Provider         │
│  │          │<───│ (:4000 預設)        │<── (OpenAI, Anthropic   │
│  └──────────┘    └────────┬───────────┘    Google, Mistral...)   │
│       │                   │                                     │
│       │ SDK               │ 指標資料                             │
│       │ (選用)             │ (tokens, model, latency, cost)      │
│       │                   │                                     │
│       ▼                   ▼                                     │
│  ┌─────────────────────────────────────┐                        │
│  │       Express 伺服器 (:8080 預設)    │                        │
│  │                                     │                        │
│  │  ┌───────────┐  ┌────────────────┐  │                        │
│  │  │ REST API  │  │ React 儀表板    │  │                        │
│  │  │ /api/*    │  │ (Vite 建置)    │  │                        │
│  │  └─────┬─────┘  └────────────────┘  │                        │
│  │        │                            │                        │
│  │  ┌─────▼─────────────────────────┐  │                        │
│  │  │      SQLite 資料庫             │  │                        │
│  │  │  ~/.agenttrace/data.db        │  │                        │
│  │  └───────────────────────────────┘  │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  設定檔：~/.agenttrace/config.json                               │
│  加密金鑰庫：AES-256-GCM 加密儲存                                │
└─────────────────────────────────────────────────────────────────┘
```

### 關鍵設計

- **單一指令啟動**：`agenttrace start` 同時啟動 Express 伺服器、LLM Proxy、React 儀表板
- **本地 SQLite**：所有資料儲存於 `~/.agenttrace/data.db`，無需外部資料庫
- **隱私保證**：Proxy 只提取指標資料（token 數量、模型名稱、延遲、成本），Prompt 內容與 API Key 永遠不離開本機

### 專案結構（Turborepo Monorepo）

```
agenttrace/
├── packages/
│   ├── cli/               # CLI 進入點（agenttrace 指令）
│   ├── server/            # Express API + SQLite 資料庫
│   ├── proxy/             # LLM Proxy，含指標擷取
│   ├── sdk/               # TypeScript SDK (@agenttrace/sdk)
│   └── shared/            # 共用型別、定價計算、Provider 偵測
├── apps/
│   └── dashboard-local/   # React + Vite 儀表板
├── package.json           # Monorepo 根設定
└── turbo.json             # Turborepo 設定
```

---

## 3. 安裝與快速開始

### 3.1 安裝

**方式 A：一鍵安裝（推薦）**

```bash
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/install.sh | sh
```

此腳本會自動偵測平台、在需要時下載 Node.js，並將 AgentTrace 安裝到 `~/.agenttrace/`。無需任何前置條件。

**方式 B：Homebrew（macOS / Linux）**

```bash
brew install agenttrace/tap/agenttrace
```

**方式 C：npm（需要 Node.js >= 18）**

```bash
# 直接執行
npx agenttrace

# 或全域安裝
npm install -g agenttrace
```

### 3.2 解除安裝

```bash
# 若透過 curl | sh 安裝
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/uninstall.sh | sh
# 或：agenttrace uninstall

# 若透過 Homebrew 安裝
brew uninstall agenttrace

# 若透過 npm 安裝
npm uninstall -g agenttrace
```

> 注意：解除安裝**不會**移除使用者資料（`~/.agenttrace/config.json`、`~/.agenttrace/data.db`）。curl 解除安裝程式會詢問是否移除；其他方式請手動刪除 `~/.agenttrace/`。

### 3.3 首次設定

第一次使用時，執行初始化設定精靈：

```bash
agenttrace onboard
```

此指令會：

1. 在 `~/.agenttrace/` 目錄下建立 `config.json` 設定檔
2. 產生認證 Token（用於 API 存取與儀表板登入）
3. 引導你設定 LLM Provider 的 API Key

### 3.4 啟動服務

```bash
agenttrace start
```

啟動後會自動開啟瀏覽器，前往儀表板：

```
http://localhost:8080
```

預設連接埠：

| 服務 | 連接埠 | 說明 |
|------|--------|------|
| Express 伺服器 + 儀表板 | 8080 | REST API 與 React 儀表板 |
| LLM Proxy | 4000 | 代理 LLM 請求並擷取指標 |

### 3.5 快速驗證

啟動後，可以用以下方式快速驗證系統是否正常運作：

```bash
# 檢查伺服器健康狀態
curl http://localhost:8080/api/health

# 檢查 Proxy 健康狀態
curl http://localhost:4000/health

# 使用內建診斷工具
agenttrace doctor
```

---

## 4. CLI 指令參考

### 指令總覽

| 指令 | 說明 | 旗標 |
|------|------|------|
| `onboard` | 首次設定，產生 Token，設定 Provider | — |
| `start` | 啟動伺服器、Proxy、儀表板 | `--port`（預設 8080）、`--proxy-port`（預設 4000）、`--retention-days`（預設 30）、`--no-open` |
| `status` | 顯示目前設定資訊 | — |
| `reset-token` | 重新產生認證 Token | — |
| `providers list` | 列出已設定的 Provider | — |
| `providers set <name> <key>` | 儲存 Provider API Key | — |
| `providers remove <name>` | 移除 Provider | — |
| `version` | 顯示版本號 | — |
| `doctor` | 系統健康檢查 | `--port`、`--proxy-port` |
| `agents` | 列出已註冊的 Agent | `--port`、`--proxy-port` |
| `stats [agentId]` | 顯示 Agent 統計數據 | `--port`、`--proxy-port`、`--range`（1h/24h/7d/30d，預設 24h） |
| `uninstall` | 移除 curl 安裝的 AgentTrace | `--yes`（跳過確認提示） |
| `help` | 顯示幫助訊息 | — |

### 詳細說明

#### `agenttrace onboard`

首次設定精靈。產生認證 Token 並寫入 `~/.agenttrace/config.json`，引導使用者設定 Provider API Key。

#### `agenttrace start`

啟動所有服務。

```bash
# 使用預設連接埠啟動
agenttrace start

# 自訂連接埠，不自動開啟瀏覽器
agenttrace start --port 9090 --proxy-port 5000 --no-open

# 設定資料保留天數為 7 天
agenttrace start --retention-days 7
```

| 旗標 | 預設值 | 說明 |
|------|--------|------|
| `--port` | `8080` | Express 伺服器與儀表板連接埠 |
| `--proxy-port` | `4000` | LLM Proxy 連接埠 |
| `--retention-days` | `30` | 事件資料保留天數 |
| `--no-open` | `false` | 啟動時不自動開啟瀏覽器 |

#### `agenttrace status`

顯示目前的設定，包括 Token 前綴、已設定的 Provider、資料庫路徑等。

#### `agenttrace reset-token`

重新產生認證 Token。舊 Token 將立即失效，需要更新所有使用舊 Token 的 SDK 設定與儀表板登入。

#### `agenttrace providers`

管理 LLM Provider 的 API Key。

```bash
# 列出所有已設定的 Provider
agenttrace providers list

# 設定 OpenAI API Key（安全加密儲存）
agenttrace providers set openai sk-xxxxxxxxxxxxx

# 移除 Anthropic Provider
agenttrace providers remove anthropic
```

#### `agenttrace doctor`

執行系統健康檢查，驗證伺服器與 Proxy 是否正常運作。

```bash
agenttrace doctor
agenttrace doctor --port 9090 --proxy-port 5000
```

#### `agenttrace agents`

列出所有已註冊的 Agent 及其狀態。

```bash
agenttrace agents
```

#### `agenttrace stats`

顯示 Agent 的統計數據。如果系統中只有一個 Agent，會自動選擇該 Agent。

```bash
# 顯示所有 Agent 的統計（預設 24 小時）
agenttrace stats

# 顯示特定 Agent 的統計，時間範圍 7 天
agenttrace stats my-agent --range 7d
```

---

## 5. Proxy 代理伺服器

Proxy 是一個本地 HTTP 代理，透明地攔截你的 AI Agent 對 LLM Provider 的請求，自動提取 token 用量、延遲、成本等指標，**無需修改任何現有程式碼**。

### 5.1 路徑前綴路由（推薦）

Proxy 支援路徑前綴路由，將請求自動轉發到對應的 Provider：

| 路徑前綴 | 目標 |
|----------|------|
| `/openai/...` | `https://api.openai.com` |
| `/anthropic/...` | `https://api.anthropic.com` |
| `/google/...` | `https://generativelanguage.googleapis.com` |
| `/cohere/...` | `https://api.cohere.ai` |
| `/mistral/...` | `https://api.mistral.ai` |
| `/deepseek/...` | `https://api.deepseek.com` |

#### OpenAI SDK 整合範例

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

#### Anthropic SDK 整合範例

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

### 5.2 多 Agent 追蹤：x-agent-id

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

### 5.3 使用 x-target-url Header

若路徑前綴路由無法滿足需求，可使用 `x-target-url` header 明確指定目標：

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

### 5.4 Provider 偵測優先順序

Proxy 使用以下順序偵測目標 Provider：

1. **路徑前綴** — 如 `/openai/...`、`/anthropic/...`
2. **Host Header** — 如 `Host: api.openai.com`
3. **路徑模式** — 如 `/v1/chat/completions` 對應 OpenAI
4. **x-target-url Header** — 手動指定目標 URL

### 5.5 串流支援

Proxy 同時支援串流（SSE, Server-Sent Events）與非串流回應。串流模式下，Proxy 會在串流結束後非同步地解析並擷取指標。

### 5.6 健康檢查

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

### 5.7 隱私保證

Proxy 只提取以下指標資料：

- Token 數量（輸入/輸出/合計）
- 模型名稱
- 延遲（毫秒）
- 成本（USD）
- HTTP 狀態碼

**Prompt 內容和 API Key 永遠不會傳送到 AgentTrace 伺服器。**

---

## 6. SDK 使用指南

### 6.1 安裝

```bash
npm install @agenttrace/sdk
```

### 6.2 初始化

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",           // 必填：在 onboard 時產生的 Token
  agentId: "my-agent",            // 必填：此 Agent 的唯一識別碼
  endpoint: "http://localhost:8080/api/events",  // 選填：預設指向本地伺服器
});
```

> `apiKey` 和 `agentId` 為必填參數，缺少時會拋出錯誤。

### 6.3 追蹤 LLM 呼叫

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

### 6.4 發送心跳

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

### 6.5 回報錯誤

```typescript
try {
  await someOperation();
} catch (err) {
  at.error(err as Error);
  // Error 物件的 stack trace 會自動擷取
}
```

### 6.6 自定義事件

```typescript
at.custom({
  key: "value",
  task: "data-processing",
  items_processed: 42,
});
```

### 6.7 Trace 與 Span

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

### 6.8 關閉（Graceful Shutdown）

```typescript
// 在程序退出前呼叫，確保所有暫存事件都已發送
await at.shutdown();
```

### 6.9 事件緩衝機制

SDK 採用批次發送策略以提升效率：

- 事件先暫存在記憶體 buffer 中
- 每 **5 秒**自動 flush 一次
- Buffer 達到 **50 筆**時立即 flush（以先到者為準）
- 硬性上限 **5000** 筆事件
- 網路錯誤只會記錄 warning，**不會拋出例外**（不影響你的 Agent 運行）

### 6.10 完整範例

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

---

## 7. Dashboard 儀表板

### 7.1 登入

儀表板使用 **Token 認證**。啟動服務後，在登入頁面輸入你的認證 Token 即可。Token 來源：

- 首次執行 `agenttrace onboard` 時產生
- 儲存在 `~/.agenttrace/config.json` 中
- 可透過 `agenttrace reset-token` 重新產生

### 7.2 頁面總覽

| 頁面 | 說明 |
|------|------|
| **Overview**（總覽） | 跨所有 Agent 的關鍵指標總覽 |
| **Agents**（Agent 列表） | 所有 Agent 的列表，含狀態指示燈（healthy / degraded / down），支援搜尋、篩選、分頁 |
| **Agent Detail**（Agent 詳情） | 單一 Agent 的詳細統計與圖表 |
| **Costs**（成本） | 按 Provider / Model 的成本分析與圖表 |
| **Alerts**（告警） | 告警規則管理與告警歷史 |

### 7.3 Agent 詳情頁

Agent 詳情頁提供以下資訊：

**統計卡片（Stats Cards）**

| 指標 | 說明 |
|------|------|
| Total Requests | 總請求數 |
| Total Errors | 錯誤數 |
| Error Rate | 錯誤率百分比 |
| Total Cost | 總花費（USD） |
| Tokens Used | 總 Token 用量 |
| P50 Latency | 中位數延遲（毫秒） |
| P99 Latency | 第 99 百分位延遲（毫秒） |

**圖表**（使用 Recharts 繪製）

- Token 用量趨勢圖（Input / Output token 隨時間變化）
- 成本分類圖（按 Provider / Model 分類）

**時間範圍篩選**

支援以下預設範圍：

- 1 小時（1h）
- 24 小時（24h）
- 7 天（7d）
- 30 天（30d）

### 7.4 成本分析

成本頁面提供跨 Provider 與 Model 的花費彙總：

- 成本趨勢圖
- 按 Provider 的成本分類
- 按 Model 的成本分類

---

## 8. 告警系統

### 8.1 告警規則類型

| 類型 | 說明 | 可設定參數 | 預設值 |
|------|------|-----------|--------|
| **agent_down** | Agent 長時間未發送心跳 | `duration_minutes`：視為離線的分鐘數 | 10 分鐘 |
| **error_rate** | 錯誤率超過閾值 | `threshold`：百分比；`window_minutes`：滾動視窗 | 20%、5 分鐘 |
| **budget** | 每日花費超過預算 | `threshold`：金額上限 USD | — |

### 8.2 通知管道

每條告警規則可設定以下通知方式：

**Webhook**

- 以 POST 方式發送 JSON 到指定 URL
- 失敗時自動重試 3 次，使用指數退避（1 秒 → 4 秒 → 16 秒）

**Email（SMTP）**

- 透過 SMTP 伺服器發送告警通知
- 需設定 SMTP 相關環境變數（詳見[環境變數](#12-環境變數)章節）

### 8.3 冷卻機制

每條規則觸發後，會進入 **15 分鐘**的冷卻期，期間不會重複觸發同一條規則，避免告警疲勞。

### 8.4 管理方式

告警規則可透過兩種方式管理：

1. **儀表板 UI**：在 Alerts 頁面建立、編輯、啟用/停用、刪除規則，並查看告警歷史
2. **REST API**：透過 `/api/alerts` 端點程式化管理（詳見[API 參考](#10-api-參考)章節）

### 8.5 建立告警規則（儀表板）

1. 前往 Alerts 頁面
2. 點擊 "New Alert Rule"
3. 選擇目標 Agent
4. 選擇規則類型（agent_down / error_rate / budget）
5. 設定相關參數
6. 填入 Webhook URL 和/或 Email 地址
7. 儲存規則

### 8.6 告警歷史

切換到 "History" 分頁，可以看到所有已觸發的告警記錄，包括觸發時間、目標 Agent、規則類型、告警訊息及發送方式。

---

## 9. Provider 金鑰管理

### 9.1 加密儲存

Provider 的 API Key **不會以明文形式**儲存在設定檔中。AgentTrace 使用 **AES-256-GCM** 加密金鑰庫來保護你的 API Key。

### 9.2 儲存與管理

```bash
# 儲存 OpenAI API Key（安全加密）
agenttrace providers set openai sk-xxxxxxxxxxxxx

# 儲存 Anthropic API Key
agenttrace providers set anthropic sk-ant-xxxxxxxxxxxxx

# 列出已設定的 Provider
agenttrace providers list

# 移除 Provider
agenttrace providers remove openai
```

### 9.3 金鑰庫後端

AgentTrace 支援多種金鑰庫後端，依以下優先順序自動偵測：

| 優先順序 | 後端 | 說明 |
|----------|------|------|
| 1 | 環境變數指定 | 透過 `AGENTTRACE_SECRET_BACKEND` 手動指定 |
| 2 | macOS Keychain | 在有 GUI 的 macOS 環境下自動使用 |
| 3 | Linux libsecret | 在 Linux 環境下自動使用 |
| 4 | MachineKeyStore（預設） | 基於 machine-id + 使用者名稱的 AES-256-GCM 加密 |

### 9.4 自動遷移

如果 `config.json` 中存在舊版的明文 API Key，AgentTrace 會在啟動時**自動**將其遷移到加密金鑰庫。

### 9.5 安全注入機制

Proxy 在轉發請求時，僅在 hostname 與已知 Provider 匹配時才會注入 API Key，防止金鑰洩漏到未知的第三方服務。

---

## 10. API 參考

所有 API 端點皆需認證，使用以下任一方式：

- Header：`Authorization: Bearer <token>`
- Header：`x-api-key: <token>`

### 10.1 事件（Events）

#### POST /api/events

接收批次或單一事件。

**請求格式 — 批次發送：**

```json
{
  "events": [
    {
      "agent_id": "my-agent",
      "event_type": "llm_call",
      "source": "sdk",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 500,
      "tokens_out": 200,
      "tokens_total": 700,
      "cost_usd": 0.0035,
      "latency_ms": 1200,
      "status_code": 200,
      "error_message": null,
      "tags": {}
    }
  ]
}
```

**請求格式 — 單一事件：**

```json
{
  "agent_id": "my-agent",
  "event_type": "heartbeat",
  "source": "sdk",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**事件類型：** `llm_call` | `completion` | `heartbeat` | `error` | `custom`

**事件來源：** `sdk` | `proxy`

**欄位說明：**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | 是 | Agent 識別碼 |
| `event_type` | string | 是 | 事件類型 |
| `source` | string | 是 | 資料來源（sdk / proxy） |
| `timestamp` | string | 是 | ISO-8601 時間戳 |
| `provider` | string | 否 | LLM Provider 名稱 |
| `model` | string | 否 | 模型名稱 |
| `tokens_in` | number | 否 | 輸入 token 數 |
| `tokens_out` | number | 否 | 輸出 token 數 |
| `tokens_total` | number | 否 | 總 token 數 |
| `cost_usd` | number | 否 | 花費（USD） |
| `latency_ms` | number | 否 | 延遲（毫秒） |
| `status_code` | number | 否 | HTTP 狀態碼 |
| `error_message` | string | 否 | 錯誤訊息 |
| `tags` | object | 否 | 自定義標籤（JSON 物件） |

**回應狀態碼：**

| 狀態碼 | 說明 |
|--------|------|
| `200 OK` | 所有事件驗證通過並已儲存 |
| `207 Multi-Status` | 部分事件驗證失敗，有效事件已儲存 |
| `400 Bad Request` | 所有事件驗證失敗或 JSON 格式錯誤 |
| `401 Unauthorized` | Token 無效 |
| `429 Too Many Requests` | 速率限制（每分鐘 1000 個事件），回應包含 `Retry-After` header |

#### GET /api/events

查詢事件，支援以下篩選參數：

| 參數 | 必填 | 說明 |
|------|------|------|
| `agent_id` | 是 | Agent 識別碼 |
| `from` | 否 | 起始時間（ISO-8601） |
| `to` | 否 | 結束時間（ISO-8601） |
| `event_type` | 否 | 事件類型篩選 |
| `provider` | 否 | Provider 篩選 |
| `model` | 否 | 模型篩選 |
| `trace_id` | 否 | Trace ID 篩選 |
| `search` | 否 | 搜尋關鍵字 |
| `limit` | 否 | 回傳筆數上限（最大 10000） |

#### GET /api/events/export

匯出事件資料，支援 CSV 或 JSON 格式，上限 100000 筆。

### 10.2 Agent

#### GET /api/agents

列出所有 Agent，支援分頁與搜尋。

| 參數 | 說明 |
|------|------|
| `limit` | 每頁筆數 |
| `offset` | 偏移量 |
| `search` | 搜尋關鍵字 |
| `status` | 狀態篩選（healthy / degraded / down） |

#### GET /api/agents/:agentId

取得特定 Agent 的詳細資訊。

### 10.3 統計（Stats）

#### GET /api/stats/overview

取得跨所有 Agent 的彙總統計。

| 參數 | 說明 |
|------|------|
| `range` | 時間範圍：`1h`、`24h`、`7d`、`30d` |

#### GET /api/stats/:agentId

取得特定 Agent 的統計數據。

| 參數 | 說明 |
|------|------|
| `range` | 預設時間範圍：`1h`、`24h`、`7d`、`30d` |
| `from` | 自定義起始時間（ISO-8601） |
| `to` | 自定義結束時間（ISO-8601） |

### 10.4 告警（Alerts）

#### GET /api/alerts

列出告警規則。

| 參數 | 說明 |
|------|------|
| `limit` | 每頁筆數 |
| `offset` | 偏移量 |
| `agent_id` | Agent 篩選 |
| `rule_type` | 規則類型篩選 |

#### POST /api/alerts

建立告警規則。

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "config": {
    "threshold": 20,
    "window_minutes": 5
  },
  "webhook_url": "https://hooks.example.com/alert",
  "email": "ops@example.com",
  "enabled": true
}
```

#### PUT /api/alerts/:id

更新告警規則（完整更新）。

#### DELETE /api/alerts/:id

刪除告警規則。

#### PATCH /api/alerts/:id/toggle

切換告警規則的啟用/停用狀態。

#### GET /api/alert-history

列出告警觸發歷史記錄。

### 10.5 認證（Auth）

#### POST /api/auth/verify

驗證 Token 是否有效。

```json
{
  "token": "your-token"
}
```

回傳：

```json
{
  "valid": true
}
```

### 10.6 健康檢查（Health）

#### GET /api/health

伺服器健康狀態。

```json
{
  "status": "ok"
}
```

---

## 11. Docker 部署

### 11.1 使用 Docker Compose

```bash
docker compose up -d
```

### 11.2 連接埠對應

| 連接埠 | 服務 |
|--------|------|
| 8080 | 儀表板 + REST API |
| 4000 | LLM Proxy |

### 11.3 資料持久化

Docker 使用 `agenttrace-data` Volume 來持久化 `~/.agenttrace/` 目錄，確保 SQLite 資料庫、設定檔和加密金鑰庫在容器重啟後不會遺失。

---

## 12. 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `NODE_ENV` | 設為 `production` 時使用 JSON 格式日誌 | — |
| `LOG_LEVEL` | 日誌等級：`debug` / `info` / `warn` / `error` | `info` |
| `SMTP_HOST` | SMTP 伺服器位址 | — |
| `SMTP_PORT` | SMTP 連接埠 | `587` |
| `SMTP_USER` | SMTP 使用者名稱 | — |
| `SMTP_PASS` | SMTP 密碼 | — |
| `SMTP_FROM` | 寄件者 Email 地址 | `alerts@agenttrace.dev` |
| `SMTP_SECURE` | 是否使用 TLS | `false` |
| `AGENTTRACE_SECRET_BACKEND` | 手動指定金鑰庫後端 | 自動偵測 |

### Email 告警設定範例

若要啟用 Email 告警，需設定 SMTP 環境變數：

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM=alerts@your-domain.com
export SMTP_SECURE=false
```

---

## 13. 常見問題排除

### 事件沒有出現在儀表板

1. **檢查 Token 是否正確**：確認 SDK 或 Proxy 使用的 Token 與 `~/.agenttrace/config.json` 中的一致
2. **檢查端點設定**：確認 endpoint 指向 `http://localhost:8080/api/events`
3. **確認 Buffer 已 Flush**：事件可能還在 buffer 中。呼叫 `at.shutdown()` 強制送出，或等待 5 秒的自動 flush 週期
4. **查看 console 警告**：SDK 的網路錯誤不會拋出例外，但會在 console 記錄 warning

### Proxy 無法偵測 Provider

1. **使用路徑前綴路由**：這是最可靠的方式。例如將 base URL 設為 `http://localhost:4000/openai/v1`
2. **使用 x-target-url**：在請求中加入 `x-target-url` header 明確指定目標
3. **檢查 Provider 偵測順序**：路徑前綴 → Host header → 路徑模式 → x-target-url
4. **查看 Proxy 日誌**：Proxy 會在 console 輸出偵測結果與警告訊息

### 收到 429 Too Many Requests

1. **速率限制**：每分鐘最多 1000 個事件
2. **增加 Buffer 大小**：增大 `maxBufferSize` 可以減少 flush 次數
3. **查看 Retry-After**：回應 header 中的 `Retry-After` 會告訴你需要等待多少秒

### Agent 狀態顯示為 "unknown"

1. **確認有發送心跳**：使用 `at.heartbeat()` 定期發送心跳（建議每 30 秒一次）
2. **超時判定**：超過 10 分鐘未收到心跳，Agent 會被標記為 "down"

### 儀表板登入失敗

1. **確認 Token**：查看 `~/.agenttrace/config.json` 中的 Token
2. **重新產生 Token**：執行 `agenttrace reset-token` 產生新的 Token
3. **確認伺服器已啟動**：執行 `agenttrace doctor` 檢查伺服器狀態

### 成本計算不正確

1. **確認模型名稱**：成本計算依賴 `@agenttrace/shared` 中的定價表，模型名稱必須與定價表匹配
2. **手動指定 cost_usd**：如果自動計算不準確，可在 `track()` 中手動傳入 `cost_usd` 欄位

### 連接埠衝突

如果預設連接埠已被佔用，可使用自訂連接埠啟動：

```bash
agenttrace start --port 9090 --proxy-port 5000
```

### 資料庫問題

SQLite 資料庫位於 `~/.agenttrace/data.db`。如需重置：

```bash
# 停止服務後刪除資料庫檔案
rm ~/.agenttrace/data.db

# 重新啟動，系統會自動建立新的資料庫
agenttrace start
```

---

## 14. 附錄：快速啟動檢查表

- [ ] 安裝 AgentTrace（`curl | sh`、Homebrew 或 npm）
- [ ] 執行 `agenttrace onboard` 完成首次設定
- [ ] 記下認證 Token
- [ ] 使用 `agenttrace providers set` 設定 LLM Provider API Key
- [ ] 執行 `agenttrace start` 啟動所有服務
- [ ] 在瀏覽器中開啟 `http://localhost:8080` 登入儀表板
- [ ] 在 AI Agent 中設定 Proxy（將 base URL 指向 `http://localhost:4000`）或整合 SDK
- [ ] 確認事件資料正常出現在儀表板
- [ ] 設定告警規則（agent_down / error_rate / budget）
- [ ] 執行 `agenttrace doctor` 確認系統健康

---

> AgentTrace — 本地優先的 AI Agent 可觀測性平台。一條指令，全面掌握。
