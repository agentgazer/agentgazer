# 快速開始

> 本地優先的 AI Agent 可觀測性平台 — 完整安裝、設定與使用手冊

## 平台概覽

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

## 系統架構

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

## 安裝與快速開始

### 環境需求

| 工具 | 版本 | 說明 |
|------|------|------|
| Node.js | >= 18 | JavaScript 執行環境 |
| npm | >= 10 | 套件管理器 |

無需任何雲端帳號或外部服務。

### 安裝

**方式 A：直接執行（推薦）**

```bash
npx agenttrace
```

**方式 B：全域安裝**

```bash
npm install -g agenttrace
```

### 首次設定

第一次使用時，執行初始化設定精靈：

```bash
agenttrace onboard
```

此指令會：

1. 在 `~/.agenttrace/` 目錄下建立 `config.json` 設定檔
2. 產生認證 Token（用於 API 存取與儀表板登入）
3. 引導你設定 LLM Provider 的 API Key

### 啟動服務

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

### 快速驗證

啟動後，可以用以下方式快速驗證系統是否正常運作：

```bash
# 檢查伺服器健康狀態
curl http://localhost:8080/api/health

# 檢查 Proxy 健康狀態
curl http://localhost:4000/health

# 使用內建診斷工具
agenttrace doctor
```

## 附錄：快速啟動檢查表

- [ ] 安裝 Node.js >= 18
- [ ] 執行 `npx agenttrace` 或 `npm install -g agenttrace`
- [ ] 執行 `agenttrace onboard` 完成首次設定
- [ ] 記下認證 Token
- [ ] 使用 `agenttrace providers set` 設定 LLM Provider API Key
- [ ] 執行 `agenttrace start` 啟動所有服務
- [ ] 在瀏覽器中開啟 `http://localhost:8080` 登入儀表板
- [ ] 在 AI Agent 中設定 Proxy（將 base URL 指向 `http://localhost:4000`）或整合 SDK
- [ ] 確認事件資料正常出現在儀表板
- [ ] 設定告警規則（agent_down / error_rate / budget）
- [ ] 執行 `agenttrace doctor` 確認系統健康
