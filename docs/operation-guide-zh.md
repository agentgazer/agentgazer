# AgentTrace 操作指南

> AI Agent 可觀測性平台 — 完整部署與使用手冊

---

## 目錄

1. [平台概覽](#1-平台概覽)
2. [系統架構](#2-系統架構)
3. [環境需求](#3-環境需求)
4. [Supabase 後端設定](#4-supabase-後端設定)
5. [本地開發環境](#5-本地開發環境)
6. [SDK 使用指南](#6-sdk-使用指南)
7. [Proxy 代理伺服器](#7-proxy-代理伺服器)
8. [Dashboard 儀表板](#8-dashboard-儀表板)
9. [告警系統](#9-告警系統)
10. [部署上線](#10-部署上線)
11. [API 參考](#11-api-參考)
12. [測試](#12-測試)
13. [資料庫結構](#13-資料庫結構)
14. [常見問題排除](#14-常見問題排除)

---

## 1. 平台概覽

AgentTrace 是一個 **AI Agent 層級** 的可觀測性平台，專為監控 AI Agent 的健康狀態、行為模式和成本而設計。

### 核心功能

- **即時監控**：追蹤每個 Agent 的 LLM 呼叫、延遲、錯誤率
- **成本分析**：按 Provider / Model 分類的花費追蹤，支援每日預算告警
- **健康偵測**：基於心跳機制自動判定 Agent 狀態（healthy / degraded / down）
- **告警通知**：支援 Agent 下線、錯誤率閾值、預算超標等告警規則，透過 Webhook 或 Email 發送
- **隱私優先**：Proxy 模式下，prompt 和 API Key 永遠不會離開使用者的機器

### 資料收集方式

| 方式 | 說明 | 適用場景 |
|------|------|----------|
| **SDK** | 在程式碼中手動埋點追蹤 | 需要精確控制要追蹤哪些呼叫 |
| **Proxy** | 透明代理攔截 LLM 請求 | 無需修改現有程式碼，自動收集所有 LLM 呼叫 |

### 支援的 LLM Provider

| Provider | Host Pattern | 自動偵測 |
|----------|-------------|---------|
| OpenAI | `api.openai.com` | `/v1/chat/completions`, `/v1/completions` |
| Anthropic | `api.anthropic.com` | `/v1/messages` |
| Google | `generativelanguage.googleapis.com` | Host 比對 |
| Mistral | `api.mistral.ai` | Host 比對 |
| Cohere | `api.cohere.com` | Host 比對 |

---

## 2. 系統架構

```
┌─────────────────────────────────────────────────────┐
│                    使用者的機器                        │
│                                                     │
│  ┌──────────┐    ┌───────────────┐                  │
│  │ AI Agent │───>│ AgentTrace SDK│──┐               │
│  └──────────┘    └───────────────┘  │               │
│                                     │  HTTPS        │
│  ┌──────────┐    ┌───────────────┐  │               │
│  │ AI Agent │───>│ AgentTrace    │──┤               │
│  │          │<───│ Proxy         │  │               │
│  └──────────┘    └───────────────┘  │               │
│                  (prompt 不會外傳)    │               │
└─────────────────────────────────────┼───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │    Supabase Backend      │
                        │                         │
                        │  ┌───────────────────┐  │
                        │  │ Edge Function:     │  │
                        │  │ /v1/ingest         │  │
                        │  └────────┬──────────┘  │
                        │           │              │
                        │  ┌────────▼──────────┐  │
                        │  │ PostgreSQL         │  │
                        │  │ + RLS + Realtime   │  │
                        │  └────────┬──────────┘  │
                        │           │              │
                        │  ┌────────▼──────────┐  │
                        │  │ Edge Function:     │  │
                        │  │ check-alerts       │  │
                        │  └───────────────────┘  │
                        └─────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │   Next.js Dashboard      │
                        │   (Vercel 部署)           │
                        │                         │
                        │  - Agent 列表與詳情      │
                        │  - 即時數據圖表          │
                        │  - 成本分析              │
                        │  - 告警管理              │
                        │  - API Key 管理          │
                        └─────────────────────────┘
```

### 專案結構（Turborepo Monorepo）

```
np1/
├── apps/
│   └── dashboard/          # Next.js 儀表板應用
│       ├── app/
│       │   ├── (dashboard)/ # 登入後的主要頁面
│       │   │   ├── page.tsx           # 首頁（Agent 總覽）
│       │   │   ├── agents/            # Agent 列表與詳情
│       │   │   ├── costs/             # 成本分析
│       │   │   ├── alerts/            # 告警規則管理
│       │   │   └── keys/              # API Key 管理
│       │   ├── auth/callback/         # OAuth 回調
│       │   └── login/                 # 登入頁面
│       └── lib/                       # Supabase client 工具
├── packages/
│   ├── shared/             # 共用型別、Provider 偵測、定價計算
│   ├── sdk/                # TypeScript SDK (@agenttrace/sdk)
│   └── proxy/              # 本地代理伺服器 (@agenttrace/proxy)
├── supabase/
│   ├── config.toml         # Supabase 專案設定
│   ├── functions/
│   │   ├── ingest/         # 事件接收 Edge Function
│   │   └── check-alerts/   # 告警檢查 Edge Function
│   └── migrations/
│       └── 001_initial_schema.sql  # 資料庫 Schema
├── package.json            # Monorepo 根設定
└── turbo.json              # Turborepo 設定
```

---

## 3. 環境需求

### 必要工具

| 工具 | 版本 | 說明 |
|------|------|------|
| Node.js | >= 18 | JavaScript 執行環境 |
| npm | >= 10 | 套件管理器 |
| Supabase CLI | 最新版 | `npm install -g supabase` |
| Git | 最新版 | 版本控制 |

### 帳號需求

| 服務 | 說明 |
|------|------|
| [Supabase](https://supabase.com) | 後端服務（免費方案即可開始） |
| [Vercel](https://vercel.com) | Dashboard 部署（選用，也可自行部署） |
| [GitHub](https://github.com) | OAuth 登入 Provider（在 Supabase Auth 設定） |

---

## 4. Supabase 後端設定

### 4.1 建立 Supabase 專案

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard) 建立新專案
2. 記下以下資訊（稍後會用到）：
   - **Project URL**：`https://<project-id>.supabase.co`
   - **Anon Key**：`eyJ...`（公開金鑰，用於前端）
   - **Service Role Key**：`eyJ...`（私密金鑰，僅用於 Edge Function）

### 4.2 執行資料庫遷移

在 Supabase Dashboard 的 **SQL Editor** 中執行 `supabase/migrations/001_initial_schema.sql` 的全部內容。

此遷移會建立以下資料表：

| 資料表 | 說明 |
|--------|------|
| `api_keys` | API 金鑰（儲存 SHA-256 hash，非明文） |
| `agents` | Agent 註冊資訊與狀態 |
| `agent_events` | 所有事件資料（LLM 呼叫、心跳、錯誤等） |
| `alert_rules` | 告警規則設定 |
| `alert_history` | 告警觸發歷史記錄 |

同時會設定：
- **Row Level Security (RLS)**：每個使用者只能看到自己的資料
- **Realtime**：啟用 `agent_events` 和 `agents` 表的即時訂閱

或者使用 Supabase CLI：

```bash
# 連結到你的 Supabase 專案
supabase link --project-ref <your-project-ref>

# 執行遷移
supabase db push
```

### 4.3 部署 Edge Functions

```bash
# 部署事件接收 API
supabase functions deploy ingest

# 部署告警檢查函數
supabase functions deploy check-alerts
```

Edge Function 會自動取得以下環境變數：
- `SUPABASE_URL` — 專案 URL
- `SUPABASE_SERVICE_ROLE_KEY` — 服務角色金鑰（有完整權限）

### 4.4 設定 GitHub OAuth 登入

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers) 建立一個 OAuth App
2. 設定：
   - **Homepage URL**：`https://your-dashboard-url.vercel.app`
   - **Authorization callback URL**：`https://<project-id>.supabase.co/auth/v1/callback`
3. 在 Supabase Dashboard → Authentication → Providers → GitHub：
   - 啟用 GitHub Provider
   - 填入 Client ID 和 Client Secret

### 4.5 設定告警排程（選用）

若要啟用自動告警檢查（如 Agent 下線偵測），需設定定時呼叫 `check-alerts` Edge Function：

**方法 A：使用 Supabase Cron（推薦）**

在 SQL Editor 中執行：

```sql
select cron.schedule(
  'check-alerts-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-id>.supabase.co/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**方法 B：使用外部 Cron 服務**

使用 [cron-job.org](https://cron-job.org) 或類似服務，每分鐘 POST 到：
```
https://<project-id>.supabase.co/functions/v1/check-alerts
```

---

## 5. 本地開發環境

### 5.1 安裝相依套件

```bash
# 在專案根目錄
npm install
```

這會安裝所有 workspace 的相依套件，包括：
- `apps/dashboard` — Next.js 儀表板
- `packages/shared` — 共用程式庫
- `packages/sdk` — TypeScript SDK
- `packages/proxy` — 本地代理伺服器

### 5.2 設定環境變數

複製範例檔案並填入實際值：

```bash
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
```

編輯 `apps/dashboard/.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 5.3 編譯與啟動

```bash
# 編譯所有套件
npm run build

# 啟動開發模式（所有套件同時啟動 watch mode）
npm run dev
```

Turborepo 指令：

| 指令 | 說明 |
|------|------|
| `npm run dev` | 同時啟動所有套件的開發模式 |
| `npm run build` | 編譯所有套件 |
| `npm run lint` | 執行所有套件的 lint 檢查 |
| `npm run test` | 執行所有套件的測試 |

Dashboard 預設啟動在 `http://localhost:3000`。

---

## 6. SDK 使用指南

### 6.1 安裝

```bash
npm install @agenttrace/sdk
```

### 6.2 初始化

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const watch = AgentTrace.init({
  apiKey: "aw_your_api_key",   // 必填：在 Dashboard 的 Keys 頁面產生
  agentId: "my-agent",         // 必填：此 Agent 的唯一識別碼
  endpoint: "https://<project-id>.supabase.co/functions/v1/ingest",  // 選填
  flushInterval: 5000,         // 選填：自動 flush 間隔（毫秒），預設 5000
  maxBufferSize: 50,           // 選填：buffer 滿時觸發 flush，預設 50
});
```

> `apiKey` 和 `agentId` 為必填參數，缺少時會拋出錯誤。

### 6.3 追蹤 LLM 呼叫

```typescript
watch.track({
  provider: "openai",           // LLM Provider 名稱
  model: "gpt-4o",              // 模型名稱
  tokens: {
    input: 500,                 // 輸入 token 數
    output: 200,                // 輸出 token 數
    total: 700,                 // 總 token 數（選填）
  },
  latency_ms: 1200,             // 延遲（毫秒）
  status: 200,                  // HTTP 狀態碼
  error_message: null,          // 錯誤訊息（選填）
  tags: {                       // 自定義標籤（選填）
    task: "summarization",
    user_id: "u_123",
  },
});
```

### 6.4 發送心跳

定期呼叫 `heartbeat()` 表示 Agent 仍在運行：

```typescript
// 建議每 30 秒發送一次
const heartbeatTimer = setInterval(() => {
  watch.heartbeat();
}, 30_000);
```

Agent 狀態判定規則：
- **Healthy**（健康）：最後心跳 < 2 分鐘前
- **Degraded**（降級）：最後心跳 2-10 分鐘前
- **Down**（離線）：最後心跳 > 10 分鐘前

### 6.5 回報錯誤

```typescript
try {
  await someOperation();
} catch (err) {
  // 接受 Error 物件或字串
  watch.error(err);
  // Error 物件的 stack trace 會自動儲存在 tags.stack 中
}
```

### 6.6 自定義事件

```typescript
watch.custom({
  task: "data-processing",
  items_processed: 42,
  duration_ms: 3500,
});
```

### 6.7 關閉（Graceful Shutdown）

```typescript
// 在程序退出前呼叫，確保所有暫存事件都已發送
await watch.shutdown();
```

### 6.8 事件緩衝機制

SDK 採用批次發送策略以提升效率：

- 事件先暫存在記憶體 buffer 中
- 每 **5 秒** 自動 flush 一次（可透過 `flushInterval` 調整）
- buffer 達到 **50 筆** 時立即 flush（可透過 `maxBufferSize` 調整）
- 網路錯誤只會記錄 warning，**不會拋出例外**（不影響你的 Agent 運行）
- Timer 使用 `unref()`，不會阻止 Node.js 程序正常退出

### 6.9 完整範例

```typescript
import { AgentTrace } from "@agenttrace/sdk";
import OpenAI from "openai";

const watch = AgentTrace.init({
  apiKey: process.env.AGENTTRACE_API_KEY!,
  agentId: "my-chatbot",
  endpoint: "https://your-project.supabase.co/functions/v1/ingest",
});

const openai = new OpenAI();

// 定期發送心跳
setInterval(() => watch.heartbeat(), 30_000);

async function chat(userMessage: string): Promise<string> {
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userMessage }],
    });

    watch.track({
      provider: "openai",
      model: "gpt-4o",
      tokens: {
        input: response.usage?.prompt_tokens,
        output: response.usage?.completion_tokens,
        total: response.usage?.total_tokens,
      },
      latency_ms: Date.now() - start,
      status: 200,
    });

    return response.choices[0].message.content ?? "";
  } catch (err) {
    watch.error(err as Error);
    throw err;
  }
}

// 程序結束前
process.on("SIGTERM", async () => {
  await watch.shutdown();
  process.exit(0);
});
```

---

## 7. Proxy 代理伺服器

Proxy 是一個本地 HTTP 代理，可以透明地攔截你的 AI Agent 對 LLM Provider 的請求，自動提取 token 用量、延遲、成本等指標，**不需要修改現有程式碼**。

### 7.1 安裝

```bash
npm install -g @agenttrace/proxy
```

或在 monorepo 中直接使用。

### 7.2 啟動

```bash
agenttrace-proxy \
  --api-key "aw_your_api_key" \
  --agent-id "my-agent" \
  --port 4000 \
  --endpoint "https://your-project.supabase.co/functions/v1/ingest"
```

| 參數 | 必填 | 預設值 | 說明 |
|------|------|--------|------|
| `--api-key` | 是 | — | AgentTrace API Key |
| `--agent-id` | 是 | — | Agent 識別碼 |
| `--port` | 否 | `4000` | 監聽埠號 |
| `--endpoint` | 否 | AgentTrace Cloud | 事件接收 API URL |
| `--help` | — | — | 顯示幫助訊息 |

### 7.3 使用方式

#### 方式 A：透明代理模式（推薦）

將 LLM 請求的 base URL 指向 Proxy，並設定 `Host` header 為目標 Provider：

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/v1",  // 指向 Proxy
  // API Key 正常設定，Proxy 會透傳
});

// 正常使用，Proxy 會自動從路徑 /v1/chat/completions 偵測到是 OpenAI
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

Proxy 會自動從 **Host header** 或 **URL 路徑模式** 偵測 Provider：
- `/v1/chat/completions` → OpenAI
- `/v1/messages` → Anthropic
- 也支援 Host 比對：`api.openai.com`、`api.anthropic.com` 等

#### 方式 B：使用 x-target-url Header

若自動偵測無法滿足需求，可以明確指定目標 URL：

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

### 7.4 健康檢查

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

### 7.5 Proxy 運作原理

1. 接收來自 AI Agent 的 HTTP 請求
2. 從 Host header 或路徑模式偵測 LLM Provider
3. 將請求原樣轉發到目標 Provider（包括 Authorization header）
4. 收到回應後，先將完整回應回傳給 Agent
5. 非同步地解析回應 body，提取 token 用量、model、cost 等指標
6. 將指標事件存入 buffer，定期批次發送到 AgentTrace 後端

**隱私保證**：Proxy 只提取指標資料（token 數量、model 名稱、延遲等），**不會發送 prompt 內容或 API Key** 到 AgentTrace 伺服器。

### 7.6 事件緩衝

Proxy 也使用批次發送策略：
- 預設每 **5 秒** flush 一次
- buffer 達 **50 筆** 時立即 flush
- 使用 `Authorization: Bearer <api-key>` header 發送到 ingest API

### 7.7 優雅關閉

```
按 Ctrl+C 即可觸發優雅關閉：
1. 停止接收新請求
2. Flush 所有暫存事件
3. 關閉 HTTP Server
```

---

## 8. Dashboard 儀表板

### 8.1 頁面總覽

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/` | 首頁 | Agent 總覽，顯示所有 Agent 的狀態 |
| `/agents` | Agent 列表 | 所有 Agent 的列表，含狀態、最後心跳時間 |
| `/agents/[agentId]` | Agent 詳情 | 單一 Agent 的詳細數據、圖表、即時更新 |
| `/costs` | 成本分析 | 按 Provider / Model 的花費彙總 |
| `/alerts` | 告警管理 | 建立/編輯/刪除告警規則，查看觸發歷史 |
| `/keys` | API Key 管理 | 建立/撤銷 API Key |

### 8.2 登入

Dashboard 使用 **GitHub OAuth** 登入（透過 Supabase Auth）：

1. 在登入頁面點擊 "Sign in with GitHub"
2. GitHub 授權後自動跳轉回 Dashboard
3. 每位使用者只能看到自己的資料（RLS 隔離）

### 8.3 API Key 管理

1. 前往 `/keys` 頁面
2. 點擊 "Create New Key"
3. 輸入 Key 名稱
4. 系統產生 API Key（格式：`aw_xxxx...`）

> 請立即複製 API Key，系統只儲存 SHA-256 hash，之後無法再次查看完整 Key。

### 8.4 Agent 詳情頁

Agent 詳情頁提供以下資訊：

**統計卡片（Stats Cards）**
- Total Requests — 總請求數
- Total Errors — 錯誤數
- Error Rate — 錯誤率百分比
- Total Cost — 總花費（USD）
- Tokens Used — 總 Token 用量
- P50 Latency — 中位數延遲（毫秒）
- P99 Latency — 第 99 百分位延遲（毫秒）

**圖表**
- Token 用量趨勢圖（Input / Output token 隨時間變化）
- 成本分類圓餅圖（按 Model 分類）

**時間範圍篩選**

支援以下預設範圍：
- 1 小時
- 24 小時
- 7 天
- 30 天

也支援 **自定義日期範圍**：
1. 點擊 "Custom" 按鈕
2. 選擇開始與結束日期時間
3. 點擊 "Apply"

### 8.5 即時更新

Dashboard 使用 **Supabase Realtime** 訂閱 `agent_events` 和 `agents` 表的變更。當新事件進入時，頁面上的數據會自動更新，不需要手動重新載入。

---

## 9. 告警系統

### 9.1 告警規則類型

| 類型 | 說明 | 可設定參數 |
|------|------|-----------|
| **Agent Down** | Agent 長時間未發送心跳 | `duration_minutes`：視為離線的分鐘數（預設 10） |
| **Error Rate** | 錯誤率超過閾值 | `threshold`：百分比（預設 20）；`window_minutes`：滾動視窗（預設 5） |
| **Budget** | 每日花費超過預算 | `threshold`：金額上限 USD（預設 50） |

### 9.2 通知管道

每條告警規則至少需設定一個通知管道：

- **Webhook**：POST JSON 到指定 URL
- **Email**：發送告警通知到指定信箱

### 9.3 建立告警規則

1. 前往 `/alerts` 頁面
2. 點擊 "New Alert Rule"
3. 選擇目標 Agent
4. 選擇規則類型（Agent Down / Error Rate / Budget）
5. 設定相關參數
6. 填入 Webhook URL 和/或 Email
7. 點擊 "Save Rule"

### 9.4 編輯告警規則

1. 在告警規則列表中，點擊目標規則的 "Edit" 按鈕
2. 修改設定
3. 點擊 "Update Rule"

### 9.5 啟用/停用告警規則

每條規則旁邊都有一個開關（Toggle），可以即時啟用或停用，不需要刪除規則。

### 9.6 查看告警歷史

切換到 "History" 分頁，可以看到所有已觸發的告警記錄，包括：
- 觸發時間
- 目標 Agent
- 規則類型
- 告警訊息
- 發送方式（Webhook / Email）

---

## 10. 部署上線

### 10.1 Dashboard 部署到 Vercel

**方式 A：透過 Vercel Dashboard**

1. 將專案推送到 GitHub
2. 在 [Vercel](https://vercel.com) 匯入該 repo
3. 設定：
   - **Root Directory**：`apps/dashboard`
   - **Framework Preset**：Next.js
4. 設定環境變數：
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-id>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-anon-key>`
5. 部署

Vercel 會自動使用 `apps/dashboard/vercel.json` 中的設定：

```json
{
  "framework": "nextjs",
  "outputDirectory": ".next",
  "buildCommand": "cd ../.. && npx turbo build --filter=dashboard",
  "installCommand": "cd ../.. && npm install",
  "rootDirectory": "apps/dashboard"
}
```

**方式 B：透過 Vercel CLI**

```bash
cd apps/dashboard
vercel
```

### 10.2 發佈 SDK 到 npm

```bash
cd packages/sdk
npm run build
npm publish --access public
```

發佈後，其他開發者可以用以下方式安裝：

```bash
npm install @agenttrace/sdk
```

### 10.3 發佈 Proxy 到 npm

```bash
cd packages/proxy
npm run build
npm publish --access public
```

發佈後，使用者可以全域安裝並直接使用 CLI：

```bash
npm install -g @agenttrace/proxy
agenttrace-proxy --api-key "aw_xxx" --agent-id "my-agent"
```

### 10.4 Edge Functions 部署

```bash
# 部署所有 Edge Functions
supabase functions deploy ingest
supabase functions deploy check-alerts
```

---

## 11. API 參考

### 11.1 事件接收 API

**Endpoint**: `POST /functions/v1/ingest`

**認證方式**（二選一）：
- Header `x-api-key: <your-api-key>`
- Header `Authorization: Bearer <your-api-key>`

**請求格式 — 批次發送**：

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

**請求格式 — 單一事件**：

```json
{
  "agent_id": "my-agent",
  "event_type": "heartbeat",
  "source": "sdk",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**事件類型**：`llm_call` | `completion` | `heartbeat` | `error` | `custom`

**事件來源**：`sdk` | `proxy`

**欄位說明**：

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | 是 | Agent 識別碼 |
| `event_type` | string | 是 | 事件類型 |
| `source` | string | 是 | 資料來源 |
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

**回應**：

- `200 OK` — 所有事件驗證通過並已儲存
- `207 Multi-Status` — 部分事件驗證失敗，有效事件已儲存

```json
{
  "status": "ok",
  "event_ids": ["uuid-1", "uuid-2"],
  "results": [
    { "index": 0, "status": "ok", "event_id": "uuid-1" },
    { "index": 1, "status": "error", "error": "Event at index 1: agent_id is required..." },
    { "index": 2, "status": "ok", "event_id": "uuid-2" }
  ]
}
```

- `400 Bad Request` — 所有事件驗證失敗，或 JSON 格式錯誤
- `401 Unauthorized` — API Key 無效或已撤銷
- `405 Method Not Allowed` — 非 POST 請求
- `429 Too Many Requests` — 速率限制（每分鐘 1000 個事件），回應包含 `Retry-After` header

**速率限制**：
- 每個 API Key 每分鐘最多 **1000** 個事件
- 超過限制時回傳 `429` 狀態碼，並在 `Retry-After` header 中指示需等待的秒數
- 每批次最多 **500** 個事件

### 11.2 Proxy 健康檢查 API

**Endpoint**: `GET /health`

```json
{
  "status": "ok",
  "agent_id": "my-agent",
  "uptime_ms": 123456
}
```

---

## 12. 測試

### 12.1 執行所有測試

```bash
npm run test
```

### 12.2 各套件獨立測試

```bash
# Shared 套件單元測試
cd packages/shared && npm test

# SDK 單元測試
cd packages/sdk && npm test

# Proxy 整合測試
cd packages/proxy && npm test

# Dashboard E2E 測試
cd apps/dashboard && npm run test:e2e
```

### 12.3 測試框架

| 套件 | 測試框架 | 測試類型 |
|------|---------|---------|
| `@agenttrace/shared` | Vitest | 單元測試 |
| `@agenttrace/sdk` | Vitest | 單元測試 |
| `@agenttrace/proxy` | Vitest | 整合測試 |
| Dashboard | Playwright | E2E 測試 |

### 12.4 SDK 測試涵蓋範圍

- 初始化驗證（必填參數檢查）
- `track()` 事件建構
- `heartbeat()` 事件建構
- `error()` 錯誤回報（含 stack trace 擷取）
- `custom()` 自定義事件
- Buffer 自動 flush 機制
- `shutdown()` 優雅關閉
- 網路錯誤不拋出例外

### 12.5 Proxy 測試涵蓋範圍

- 健康檢查端點
- 請求轉發（含 header 處理）
- Provider 自動偵測
- 指標提取與事件排隊
- 優雅關閉

---

## 13. 資料庫結構

### api_keys 表

```
┌──────────────┬────────────────┬───────────────┐
│ 欄位         │ 類型           │ 說明          │
├──────────────┼────────────────┼───────────────┤
│ id           │ uuid (PK)      │ 主鍵          │
│ user_id      │ uuid (FK)      │ 使用者 ID     │
│ key_hash     │ text (unique)  │ SHA-256 hash  │
│ key_prefix   │ text           │ 前 8 字元     │
│ name         │ text           │ Key 名稱      │
│ created_at   │ timestamptz    │ 建立時間      │
│ revoked_at   │ timestamptz    │ 撤銷時間      │
└──────────────┴────────────────┴───────────────┘
```

### agents 表

```
┌────────────────────┬────────────────┬────────────────────────┐
│ 欄位               │ 類型           │ 說明                   │
├────────────────────┼────────────────┼────────────────────────┤
│ id                 │ uuid (PK)      │ 主鍵                   │
│ user_id            │ uuid (FK)      │ 使用者 ID              │
│ agent_id           │ text           │ 使用者定義的識別碼     │
│ name               │ text           │ Agent 名稱             │
│ status             │ text           │ healthy/degraded/down  │
│ last_heartbeat_at  │ timestamptz    │ 最後心跳時間           │
│ created_at         │ timestamptz    │ 建立時間               │
│ updated_at         │ timestamptz    │ 更新時間               │
└────────────────────┴────────────────┴────────────────────────┘

唯一約束：(user_id, agent_id)
```

### agent_events 表

```
┌────────────────┬─────────────────┬──────────────────────────────┐
│ 欄位           │ 類型            │ 說明                         │
├────────────────┼─────────────────┼──────────────────────────────┤
│ id             │ uuid (PK)       │ 主鍵                         │
│ user_id        │ uuid (FK)       │ 使用者 ID                    │
│ agent_id       │ text            │ Agent 識別碼                 │
│ event_type     │ text            │ llm_call/completion/         │
│                │                 │ heartbeat/error/custom       │
│ provider       │ text            │ LLM Provider                 │
│ model          │ text            │ 模型名稱                     │
│ tokens_in      │ int             │ 輸入 token 數                │
│ tokens_out     │ int             │ 輸出 token 數                │
│ tokens_total   │ int             │ 總 token 數                  │
│ cost_usd       │ double          │ 花費 (USD)                   │
│ latency_ms     │ int             │ 延遲 (ms)                    │
│ status_code    │ int             │ HTTP 狀態碼                  │
│ error_message  │ text            │ 錯誤訊息                     │
│ tags           │ jsonb           │ 自定義標籤                   │
│ source         │ text            │ sdk / proxy                  │
│ timestamp      │ timestamptz     │ 事件發生時間                 │
│ created_at     │ timestamptz     │ 寫入資料庫的時間             │
└────────────────┴─────────────────┴──────────────────────────────┘
```

### alert_rules 表

```
┌──────────────┬────────────────┬──────────────────────────┐
│ 欄位         │ 類型           │ 說明                     │
├──────────────┼────────────────┼──────────────────────────┤
│ id           │ uuid (PK)      │ 主鍵                     │
│ user_id      │ uuid (FK)      │ 使用者 ID                │
│ agent_id     │ text           │ 目標 Agent               │
│ rule_type    │ text           │ agent_down/error_rate/   │
│              │                │ budget                   │
│ config       │ jsonb          │ 規則參數                 │
│ enabled      │ boolean        │ 是否啟用                 │
│ webhook_url  │ text           │ Webhook 通知 URL         │
│ email        │ text           │ Email 通知地址           │
│ created_at   │ timestamptz    │ 建立時間                 │
│ updated_at   │ timestamptz    │ 更新時間                 │
└──────────────┴────────────────┴──────────────────────────┘
```

### alert_history 表

```
┌────────────────┬────────────────┬──────────────────────────┐
│ 欄位           │ 類型           │ 說明                     │
├────────────────┼────────────────┼──────────────────────────┤
│ id             │ uuid (PK)      │ 主鍵                     │
│ user_id        │ uuid (FK)      │ 使用者 ID                │
│ alert_rule_id  │ uuid (FK)      │ 對應的告警規則           │
│ agent_id       │ text           │ 觸發 Agent               │
│ rule_type      │ text           │ 規則類型                 │
│ message        │ text           │ 告警訊息                 │
│ delivered_via  │ text           │ webhook / email          │
│ delivered_at   │ timestamptz    │ 發送時間                 │
└────────────────┴────────────────┴──────────────────────────┘
```

### Row Level Security (RLS)

所有資料表都啟用了 RLS，確保多租戶資料隔離：

- 每個使用者只能查看/操作自己的 `api_keys`、`agents`、`alert_rules`
- `agent_events` 使用者只能讀取（寫入由 Edge Function 的 Service Role 執行）
- `alert_history` 使用者只能讀取

### Realtime 訂閱

以下表已加入 Supabase Realtime publication：
- `agent_events` — 新事件會即時推送到 Dashboard
- `agents` — Agent 狀態變更會即時反映

---

## 14. 常見問題排除

### SDK 事件沒有出現在 Dashboard

1. **檢查 API Key 是否正確**：確認使用的是有效且未撤銷的 API Key
2. **檢查 endpoint 設定**：確認指向正確的 Supabase Edge Function URL
3. **檢查網路連線**：SDK 不會拋出網路錯誤，請查看 console 中的 warning 訊息
4. **確認已呼叫 flush 或 shutdown**：事件可能還在 buffer 中

### Proxy 無法偵測 Provider

1. **確認 URL 路徑**：Proxy 透過路徑模式偵測 Provider（如 `/v1/chat/completions` → OpenAI）
2. **使用 x-target-url**：如果自動偵測不行，在請求中加入 `x-target-url` header 明確指定
3. **查看 Proxy 日誌**：Proxy 會在 console 輸出警告訊息

### 收到 429 Too Many Requests

1. **降低發送頻率**：每個 API Key 每分鐘最多 1000 個事件
2. **增加 buffer 大小**：增大 `maxBufferSize` 減少 flush 次數
3. **查看 Retry-After**：回應 header 會告訴你需要等待多少秒

### Agent 狀態顯示為 "unknown"

1. **確認有發送心跳**：呼叫 `watch.heartbeat()` 或 `watch.track()` 都會觸發 Agent 狀態更新
2. **檢查心跳頻率**：建議每 30 秒發送一次，超過 10 分鐘沒收到心跳會被標記為 "down"

### Dashboard 登入失敗

1. **檢查 GitHub OAuth 設定**：確認 callback URL 設定正確
2. **檢查環境變數**：確認 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 設定正確
3. **清除瀏覽器 Cookie**：嘗試清除 Supabase 相關的 Cookie 後重試

### 成本計算不正確

1. **確認模型名稱**：成本計算依賴於 `@agenttrace/shared` 中的定價表，模型名稱必須與定價表匹配
2. **手動指定 cost_usd**：如果自動計算不準確，可以在 `track()` 中手動傳入 `cost_usd`

---

## 附錄：快速啟動檢查表

- [ ] 建立 Supabase 專案
- [ ] 執行資料庫遷移（`001_initial_schema.sql`）
- [ ] 設定 GitHub OAuth
- [ ] 部署 Edge Functions（`ingest`、`check-alerts`）
- [ ] 設定 Dashboard 環境變數（`.env.local`）
- [ ] 部署 Dashboard 到 Vercel
- [ ] 在 Dashboard 建立 API Key
- [ ] 在 Agent 中整合 SDK 或啟動 Proxy
- [ ] 設定告警規則
- [ ] 驗證資料是否正常流入 Dashboard
