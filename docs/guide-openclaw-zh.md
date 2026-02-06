# OpenClaw + AgentGazer 整合指南

> 使用 AgentGazer 監控你的 OpenClaw 個人 AI 助手 — 零程式碼修改，完整可觀測性

---

## 目錄

1. [概述](#1-概述)
2. [前置準備](#2-前置準備)
3. [啟動 AgentGazer](#3-啟動-agentgazer)
4. [架構圖](#4-架構圖)
5. [設定 Provider 金鑰](#5-設定-provider-金鑰)
6. [Anthropic 設定](#6-anthropic-設定)
7. [OpenAI 設定](#7-openai-設定)
8. [多 Provider 設定](#8-多-provider-設定)
9. [驗證](#9-驗證)
10. [設定告警](#10-設定告警)
11. [常見問題排除](#11-常見問題排除)

---

## 1. 概述

[OpenClaw](https://openclaw.ai) 是一個開源的個人 AI 助手，以 TypeScript/Node.js 建構，在本地機器上運行。它支援多種 LLM Provider（Anthropic、OpenAI），並透過 `~/.openclaw/openclaw.json` 設定檔進行配置。

### 為什麼需要監控 OpenClaw？

OpenClaw 作為一個自主運行的 AI Agent，會持續地向 LLM Provider 發送請求。如果沒有適當的監控機制，以下問題可能在你不知情的情況下發生：

- **成本失控**：OpenClaw 自主發起的 LLM 呼叫可能迅速累積大量費用，缺乏可見性意味著帳單可能遠超預期
- **錯誤無聲發生**：API 呼叫失敗、速率限制、認證過期等問題不會主動通知你
- **效能劣化**：延遲增加、回應品質下降等問題需要歷史數據才能有效診斷
- **服務中斷**：OpenClaw 可能因各種原因停止運作，而你可能數小時後才發現

### AgentGazer 提供的解決方案

透過 AgentGazer 的 Proxy 模式整合 OpenClaw，你可以：

- **追蹤每筆 LLM 呼叫的成本**：按 Provider、按模型分類的花費明細
- **即時監控延遲與錯誤率**：第一時間發現異常
- **設定告警規則**：Agent 離線偵測、錯誤率閾值、每日預算上限
- **零程式碼修改**：只需更改 OpenClaw 的 `baseUrl` 設定，不需要 fork 或修改任何原始碼

### 運作原理

OpenClaw 的 `models.providers` 設定支援 `baseUrl` 覆蓋。我們只需將 `baseUrl` 指向 AgentGazer Proxy，Proxy 便會透明地攔截所有 LLM 請求，自動提取 token 用量、延遲、成本等指標，再將請求原樣轉發到實際的 LLM Provider。整個過程對 OpenClaw 完全透明。

---

## 2. 前置準備

### 環境需求

| 項目 | 需求 | 說明 |
|------|------|------|
| Node.js | >= 18 | JavaScript 執行環境 |
| AgentGazer | 最新版 | `npm install -g agentgazer` 或使用 `npx agentgazer` |
| OpenClaw | 已安裝並運行 | 從 [openclaw.ai](https://openclaw.ai) 取得 |

### API 金鑰

至少需要以下其中一個 LLM Provider 的 API 金鑰：

- **Anthropic API Key**：從 [console.anthropic.com](https://console.anthropic.com) 取得
- **OpenAI API Key**：從 [platform.openai.com](https://platform.openai.com) 取得

### 確認 OpenClaw 正常運行

在開始整合之前，請先確認 OpenClaw 已正確安裝並可正常運作：

```bash
# 確認 OpenClaw 設定檔存在
ls ~/.openclaw/openclaw.json

# 確認 OpenClaw 服務正在運行
openclaw status
```

---

## 3. 啟動 AgentGazer

### 快速啟動

```bash
npx agentgazer
```

啟動後，終端機會顯示以下資訊：

```
AgentGazer server running on http://localhost:8080
AgentGazer proxy running on http://localhost:4000
Auth token: at_xxxxxxxxxxxxxxxx
```

請記下顯示的 **Auth Token**，稍後設定告警時會用到。

### 預設連接埠

| 服務 | 連接埠 | 用途 |
|------|--------|------|
| AgentGazer Server | `:8080` | REST API 與 Dashboard（React） |
| AgentGazer Proxy | `:4000` | LLM 請求透明代理 |

### 開啟 Dashboard

在瀏覽器中前往 [http://localhost:8080](http://localhost:8080)，即可看到 AgentGazer 的即時監控儀表板。

---

## 4. 架構圖

以下圖示說明 OpenClaw 透過 AgentGazer Proxy 連接 LLM Provider 的完整資料流：

```
┌─────────────────────────────────────────────────────────────┐
│                        使用者的機器                            │
│                                                             │
│  ┌───────────────┐     ┌──────────────────┐                 │
│  │   OpenClaw     │────▶│  AgentGazer      │                 │
│  │   Gateway      │     │  Proxy :4000     │                 │
│  │               │     │                  │                 │
│  │  openclaw.json:│     │  自動擷取：        │                 │
│  │  baseUrl →     │     │  - tokens        │                 │
│  │  localhost:4000│     │  - cost          │                 │
│  └───────────────┘     │  - latency       │                 │
│                        └────────┬─────────┘                 │
│                                 │                           │
│                     ┌───────────▼───────────┐               │
│                     │  LLM Provider APIs     │               │
│                     │  api.anthropic.com     │               │
│                     │  api.openai.com        │               │
│                     └───────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  AgentGazer Server :8080                  │               │
│  │  ├── REST API  (/api/*)                   │               │
│  │  ├── SQLite (data.db)                     │               │
│  │  └── Dashboard (React)                    │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 資料流程

1. OpenClaw 發送 LLM 請求到 `http://localhost:4000`（AgentGazer Proxy）
2. Proxy 透明地將請求轉發到實際的 LLM Provider（如 `api.anthropic.com`）
3. Proxy 接收到 Provider 回應後，先將完整回應回傳給 OpenClaw
4. Proxy 非同步地解析回應，提取 token 用量、模型名稱、延遲、成本等指標
5. 指標資料儲存到本地 SQLite 資料庫（`data.db`）
6. Dashboard 從 Server 讀取資料並以圖表呈現

**隱私保證**：Proxy 只提取指標資料（token 數量、模型名稱、延遲等），**不會記錄或發送 prompt 內容**。所有資料都保留在你的本地機器上。

---

## 5. 設定 Provider 金鑰

AgentGazer Proxy 可以為你自動注入 API 金鑰。要啟用金鑰注入，你必須使用**路徑前綴路由** — 在 `baseUrl` 中包含 Provider 名稱（例如 `http://localhost:4000/anthropic`）。這讓 Proxy 能安全地識別 Provider 並注入正確的憑證。

### 儲存 API 金鑰到 AgentGazer

```bash
# 儲存 Anthropic API 金鑰
agentgazer providers set anthropic $ANTHROPIC_API_KEY

# 儲存 OpenAI API 金鑰
agentgazer providers set openai $OPENAI_API_KEY
```

### 自動注入的運作方式

| baseUrl | Provider | 注入的 Header |
|---------|----------|---------------|
| `http://localhost:4000/anthropic` | Anthropic | `x-api-key: <key>` |
| `http://localhost:4000/openai` | OpenAI | `Authorization: Bearer <key>` |

當你使用路徑前綴路由（例如 `/anthropic/...`）時，Proxy 會去除前綴，將請求轉發到真正的 Provider URL，並自動注入已儲存的 API 金鑰。

這意味著你可以在 OpenClaw 設定中**省略 `apiKey` 欄位**，讓 Proxy 統一管理所有 Provider 金鑰。

> **重要**：金鑰注入僅在使用路徑前綴路由時生效。如果你的 `baseUrl` 是 `http://localhost:4000`（無前綴），Proxy 仍然可以收集指標，但**不會**注入 API 金鑰 — 在此情況下，你必須在 `openclaw.json` 中包含 `apiKey`，讓 OpenClaw 直接進行認證。

> **注意**：如果你選擇在 `openclaw.json` 中直接指定 `apiKey`，該金鑰會被 OpenClaw 附加在請求中，Proxy 會原樣轉發，不會覆蓋。

---

## 6. Anthropic 設定

編輯 `~/.openclaw/openclaw.json`，將 Anthropic Provider 的 `baseUrl` 指向 AgentGazer Proxy：

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "api": "anthropic-messages"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-opus-4-5"
      }
    }
  }
}
```

### 欄位說明

| 欄位 | 說明 |
|------|------|
| `baseUrl` | 指向 AgentGazer Proxy 並包含 Provider 路徑前綴（`http://localhost:4000/anthropic`）。Proxy 會去除 `/anthropic` 前綴並轉發到 `api.anthropic.com` |
| `apiKey` | Anthropic API 金鑰。若已透過 `agentgazer providers set` 儲存，可省略此欄位（需要 `baseUrl` 包含路徑前綴） |
| `api` | 指定 API 協定為 `anthropic-messages`，讓 Proxy 能正確偵測 Provider |
| `primary` | 使用的模型，格式為 `<provider-name>/<model-name>` |

### 省略 apiKey 的簡化設定（建議）

如果你已透過 `agentgazer providers set anthropic` 儲存了金鑰：

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "api": "anthropic-messages"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-opus-4-5"
      }
    }
  }
}
```

### 支援的 Anthropic 模型

AgentGazer 內建以下 Anthropic 模型的定價資料，可自動計算成本：

| 模型 | 輸入成本 (每百萬 token) | 輸出成本 (每百萬 token) |
|------|------------------------|------------------------|
| `claude-opus-4-20250514` | $15.00 | $75.00 |
| `claude-sonnet-4-20250514` | $3.00 | $15.00 |
| `claude-3-5-haiku-20241022` | $0.80 | $4.00 |

---

## 7. OpenAI 設定

編輯 `~/.openclaw/openclaw.json`，將 OpenAI Provider 的 `baseUrl` 指向 AgentGazer Proxy：

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "openai-traced": {
        "baseUrl": "http://localhost:4000/openai",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-completions"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai-traced/gpt-4o"
      }
    }
  }
}
```

### 欄位說明

| 欄位 | 說明 |
|------|------|
| `baseUrl` | 指向 AgentGazer Proxy 並包含 Provider 路徑前綴（`http://localhost:4000/openai`）。Proxy 會去除 `/openai` 前綴並轉發到 `api.openai.com` |
| `apiKey` | OpenAI API 金鑰。若已透過 `agentgazer providers set` 儲存，可省略此欄位（需要 `baseUrl` 包含路徑前綴） |
| `api` | 指定 API 協定為 `openai-completions`，讓 Proxy 能正確偵測 Provider |
| `primary` | 使用的模型，格式為 `<provider-name>/<model-name>` |

### 支援的 OpenAI 模型

AgentGazer 內建以下 OpenAI 模型的定價資料：

| 模型 | 輸入成本 (每百萬 token) | 輸出成本 (每百萬 token) |
|------|------------------------|------------------------|
| `gpt-4o` | $2.50 | $10.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |
| `o1` | $15.00 | $60.00 |
| `o1-mini` | $3.00 | $12.00 |
| `o3-mini` | $1.10 | $4.40 |

---

## 8. 多 Provider 設定

OpenClaw 支援同時使用多個 LLM Provider。以下設定同時啟用 Anthropic 和 OpenAI，並讓所有請求都經過 AgentGazer Proxy：

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "api": "anthropic-messages"
      },
      "openai-traced": {
        "baseUrl": "http://localhost:4000/openai",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-completions"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-opus-4-5",
        "secondary": "openai-traced/gpt-4o"
      }
    }
  }
}
```

### 設定說明

- **`primary`**：OpenClaw 預設使用的主要模型（此處為 Anthropic Claude Opus 4.5）
- **`secondary`**：當主要模型不可用或發生錯誤時的備援模型（此處為 OpenAI GPT-4o）
- 每個 Provider 的 `baseUrl` 都包含各自的路徑前綴（`/anthropic`、`/openai`），讓 Proxy 能識別 Provider 並注入正確的 API 金鑰
- Proxy 會去除路徑前綴，再將請求轉發到真正的 Provider URL

### 多 Provider 的監控優勢

當同時使用多個 Provider 時，AgentGazer Dashboard 可以：

- 按 Provider 分類顯示成本比較
- 追蹤各 Provider 的錯誤率差異
- 比較不同 Provider 的延遲表現
- 在 Provider 切換（failover）時提供完整的呼叫記錄

---

## 9. 驗證

完成設定後，依照以下步驟驗證整合是否成功。

### 步驟 1：確認 AgentGazer 正在運行

```bash
# 啟動 AgentGazer（如果尚未啟動）
npx agentgazer

# 或者如果已全域安裝
agentgazer start
```

確認終端機顯示 Proxy 已在 `:4000` 監聽。

### 步驟 2：重新啟動 OpenClaw

修改 `openclaw.json` 後，需要重新啟動 OpenClaw Gateway 使設定生效：

```bash
# 重新啟動 OpenClaw（依你的啟動方式而定）
openclaw restart

# 或者先停止再啟動
openclaw stop
openclaw start
```

### 步驟 3：發送測試訊息

透過 OpenClaw 支援的任何管道發送一則測試訊息：

- Discord 機器人
- Telegram 機器人
- 其他已設定的輸入管道

例如，在 Discord 中向 OpenClaw 機器人發送：

```
@OpenClaw 你好，這是一則測試訊息。
```

### 步驟 4：檢查 AgentGazer Dashboard

1. 在瀏覽器中開啟 [http://localhost:8080](http://localhost:8080)
2. 前往 **Agents** 頁面 — 你應該會看到一個新的 Agent 項目出現
3. 點擊該 Agent 進入詳情頁面

### 步驟 5：確認事件資料

在 Agent 詳情頁面中，確認以下資訊是否正確顯示：

| 指標 | 預期值 | 說明 |
|------|--------|------|
| Provider | `anthropic` 或 `openai` | 依你的設定而定 |
| Model | `claude-opus-4-5` 或 `gpt-4o` | 依你的設定而定 |
| Tokens (Input) | > 0 | 輸入 token 數量 |
| Tokens (Output) | > 0 | 輸出 token 數量 |
| Cost (USD) | > $0.00 | 自動計算的成本 |
| Latency (ms) | > 0 | 請求延遲時間 |

如果所有指標都正確顯示，恭喜你，整合已成功完成！

### 使用 Proxy 健康檢查端點

你也可以直接檢查 Proxy 的運作狀態：

```bash
curl http://localhost:4000/health
```

預期回應：

```json
{
  "status": "ok",
  "agent_id": "openclaw",
  "uptime_ms": 123456
}
```

---

## 10. 設定告警

AgentGazer 提供多種告警規則，讓你在 OpenClaw 出現異常時即時收到通知。以下是針對 OpenClaw 使用情境最實用的告警設定。

### 10.1 Agent Down 告警 — 偵測 OpenClaw 停止運作

當 OpenClaw 長時間未發送任何 LLM 請求時，可能表示服務已停止運行。

**透過 Dashboard 設定：**

1. 開啟 AgentGazer Dashboard（`http://localhost:8080`）
2. 前往 **Alerts** 頁面
3. 點擊 **New Alert Rule**
4. 選擇目標 Agent：`openclaw`
5. 規則類型：`agent_down`
6. 設定 `duration_minutes`：`10`（10 分鐘無活動即視為離線）
7. 填入 Webhook URL
8. 點擊 **Save Rule**

**透過 API 設定：**

```bash
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "agent_down",
    "config": { "duration_minutes": 10 },
    "webhook_url": "https://your-webhook-url.com/alerts"
  }'
```

### 10.2 Error Rate 告警 — 偵測 API 呼叫失敗

當 LLM API 的錯誤率超過閾值時觸發告警。常見的錯誤原因包括：API 金鑰過期、速率限制、Provider 服務中斷等。

```bash
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "error_rate",
    "config": { "threshold": 15, "window_minutes": 10 },
    "webhook_url": "https://your-webhook-url.com/alerts"
  }'
```

**參數說明：**

| 參數 | 值 | 說明 |
|------|-----|------|
| `threshold` | `15` | 錯誤率超過 15% 時觸發告警 |
| `window_minutes` | `10` | 以最近 10 分鐘內的請求為計算基準 |

### 10.3 Budget 告警 — 每日花費上限

設定每日花費上限，防止 OpenClaw 的自主 LLM 呼叫導致成本失控。

```bash
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "budget",
    "config": { "threshold": 20 },
    "webhook_url": "https://your-webhook-url.com/alerts"
  }'
```

**參數說明：**

| 參數 | 值 | 說明 |
|------|-----|------|
| `threshold` | `20` | 當日累計花費超過 $20 USD 時觸發告警 |

### 10.4 告警規則建議

針對 OpenClaw 的典型使用場景，以下是建議的告警設定組合：

| 告警類型 | 建議設定 | 使用情境 |
|----------|---------|---------|
| Agent Down | `duration_minutes: 10` | OpenClaw 應持續運行，10 分鐘無活動即異常 |
| Error Rate | `threshold: 15, window_minutes: 10` | API 錯誤率高於 15% 需要注意 |
| Budget | `threshold: 20` | 個人使用者每日 $20 USD 通常足夠 |

> **提示**：你可以根據實際使用量調整這些數值。如果 OpenClaw 使用量較大（例如在多個聊天管道中同時服務），可以適當提高預算閾值。

---

## 11. 常見問題排除

### 問題速查表

| 問題 | 可能原因 | 解決方案 |
|------|---------|---------|
| OpenClaw 的呼叫未出現在 Dashboard | `openclaw.json` 中的 `baseUrl` 設定錯誤 | 確認 `baseUrl` 指向 Proxy 的 `:4000` 並包含 Provider 路徑前綴（例如 `http://localhost:4000/anthropic`），而非 Server 的 `:8080`，並確認 AgentGazer 正在運行 |
| Provider 無法被偵測 | `api` 協定欄位設定錯誤 | Anthropic 使用 `"api": "anthropic-messages"`，OpenAI 使用 `"api": "openai-completions"` |
| LLM Provider 回傳認證錯誤 | API 金鑰未設定或未被注入 | 透過 `agentgazer providers set` 儲存金鑰並確保 `baseUrl` 使用路徑前綴（例如 `/anthropic`），或在 `openclaw.json` 中直接包含 `apiKey` 欄位 |
| 連線被拒絕 (Connection Refused) | AgentGazer 未啟動或連接埠不正確 | 執行 `agentgazer doctor` 檢查服務狀態，確認連接埠設定一致 |
| 事件出現但沒有成本資料 | 模型名稱不在定價表中 | 檢查模型名稱是否與 `packages/shared/src/pricing.ts` 中的定價表匹配 |
| 修改設定後 OpenClaw 無法啟動 | `openclaw.json` 語法錯誤 | 驗證 JSON 語法，檢查是否有多餘的逗號（trailing commas） |

### 詳細排除步驟

#### OpenClaw 的呼叫未出現在 Dashboard

1. **確認 AgentGazer 正在運行**：

   ```bash
   # 檢查 Proxy 是否在監聽
   curl http://localhost:4000/health
   ```

   如果回傳連線錯誤，請重新啟動 AgentGazer：

   ```bash
   npx agentgazer
   ```

2. **確認 `baseUrl` 設定正確**：

   ```bash
   # 檢查 openclaw.json 中的 baseUrl
   cat ~/.openclaw/openclaw.json | grep baseUrl
   ```

   輸出應包含 `http://localhost:4000`，而非 `http://localhost:8080` 或其他位址。

3. **確認 OpenClaw 已重新啟動**：修改設定後必須重新啟動 OpenClaw 才能生效。

#### LLM Provider 回傳認證錯誤

1. **確認金鑰已正確儲存**：

   ```bash
   # 列出已儲存的 Provider 金鑰
   agentgazer providers list
   ```

2. **測試 Proxy 轉發**：

   ```bash
   # 直接透過 Proxy 發送測試請求（以 OpenAI 為例）
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "Hi"}],
       "max_tokens": 10
     }'
   ```

   如果此請求成功，表示 Proxy 轉發運作正常，問題可能出在 OpenClaw 的設定。

#### 事件出現但沒有成本資料

AgentGazer 依據內建的定價表（`packages/shared/src/pricing.ts`）自動計算成本。如果模型名稱不在定價表中，成本欄位會顯示為空。

目前支援的模型定價包括：

- **OpenAI**：`gpt-4o`、`gpt-4o-mini`、`gpt-4-turbo`、`gpt-4`、`gpt-3.5-turbo`、`o1`、`o1-mini`、`o3-mini`
- **Anthropic**：`claude-opus-4-20250514`、`claude-sonnet-4-20250514`、`claude-3-5-haiku-20241022`

> **注意**：OpenClaw 設定中的模型名稱（如 `claude-opus-4-5`）可能與 AgentGazer 定價表中的完整模型 ID 不同。Proxy 會嘗試從 API 回應中提取實際的模型 ID 進行成本計算。

#### 修改設定後 OpenClaw 無法啟動

`openclaw.json` 使用 JSON 格式。常見的語法錯誤包括：

- **多餘的逗號**：JSON 標準不允許最後一個元素後面有逗號
- **未關閉的括號**：確認所有 `{` 和 `}` 正確配對
- **環境變數未展開**：如果使用 `${ANTHROPIC_API_KEY}` 語法，確認 OpenClaw 支援環境變數替換

你可以使用以下指令驗證 JSON 語法：

```bash
# 使用 Node.js 驗證 JSON 語法
node -e "JSON.parse(require('fs').readFileSync('$HOME/.openclaw/openclaw.json','utf8')); console.log('JSON 語法正確')"
```

#### 連接埠衝突

如果預設連接埠已被其他服務佔用，你可以在啟動 AgentGazer 時指定不同的連接埠：

```bash
npx agentgazer --port 9080 --proxy-port 5000
```

然後相應地更新 `openclaw.json` 中的 `baseUrl`：

```json5
{
  "models": {
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:5000/anthropic",
        "api": "anthropic-messages"
      }
    }
  }
}
```

---

## 附錄：快速啟動檢查表

依序完成以下步驟即可快速完成整合：

- [ ] 安裝 AgentGazer（`npm install -g agentgazer` 或使用 `npx`）
- [ ] 啟動 AgentGazer（`npx agentgazer`）
- [ ] 儲存 Provider 金鑰（`agentgazer providers set anthropic <key>`）
- [ ] 編輯 `~/.openclaw/openclaw.json`，設定 `baseUrl` 為 `http://localhost:4000/<provider>`（例如 `http://localhost:4000/anthropic`）
- [ ] 重新啟動 OpenClaw Gateway
- [ ] 發送測試訊息，確認事件出現在 Dashboard
- [ ] 設定 Agent Down 告警（建議 10 分鐘）
- [ ] 設定 Budget 告警（建議每日 $20 USD）
- [ ] 設定 Error Rate 告警（建議閾值 15%）
- [ ] 持續觀察 Dashboard，確認數據正常流入
