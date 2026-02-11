# OpenClaw + AgentGazer 整合指南

> 使用 AgentGazer 監控你的 OpenClaw 個人 AI 助手 — 一鍵設定，完整可觀測性

---

## 目錄

1. [概述](#1-概述)
2. [前置準備](#2-前置準備)
3. [快速開始（Dashboard）](#3-快速開始dashboard)
4. [架構說明](#4-架構說明)
5. [設定告警](#5-設定告警)
6. [治理功能](#6-治理功能)
7. [疑難排解](#7-疑難排解)
8. [進階：手動設定](#8-進階手動設定)
9. [替代方案：直接 Provider 路由](#9-替代方案直接-provider-路由)

---

## 1. 概述

[OpenClaw](https://openclaw.ai) 是一個開源的個人 AI 助手，以 TypeScript/Node.js 建構，在本地機器上運行。它支援多種 LLM Provider（Anthropic、OpenAI、Google 等），並透過 `~/.openclaw/openclaw.json` 設定檔進行配置。

### 為什麼需要監控 OpenClaw？

OpenClaw 作為一個自主運行的 AI Agent，會持續地向 LLM Provider 發送請求。如果沒有適當的監控：

- **成本失控**：自主 LLM 呼叫可能在你不知情的情況下迅速累積大量費用
- **錯誤無聲發生**：API 失敗、速率限制、認證過期等問題不會主動通知你
- **效能劣化**：延遲增加需要歷史數據才能有效診斷
- **服務中斷**：OpenClaw 可能停止運作，而你可能數小時後才發現

### AgentGazer 提供的解決方案

整合 OpenClaw 與 AgentGazer 後，你可以：

- **追蹤每筆 LLM 呼叫的成本**：按 Provider、按模型分類的花費明細
- **監控延遲與錯誤率**：第一時間發現異常
- **設定告警規則**：Agent 離線偵測、錯誤率閾值、預算上限
- **動態切換模型**：從 Dashboard 更換 Provider/模型，無需編輯設定檔
- **零程式碼修改**：只需使用 AgentGazer 的 OpenClaw 整合頁面

---

## 2. 前置準備

### 環境需求

| 項目 | 需求 | 說明 |
|------|------|------|
| Node.js | >= 18 | JavaScript 執行環境 |
| AgentGazer | 最新版 | `npm install -g @agentgazer/cli` 或 Homebrew |
| OpenClaw | 已安裝並運行 | 從 [openclaw.ai](https://openclaw.ai) 取得 |

### API 金鑰

至少需要以下其中一個 LLM Provider 的 API 金鑰：

- **Anthropic**：從 [console.anthropic.com](https://console.anthropic.com) 取得
- **OpenAI**：從 [platform.openai.com](https://platform.openai.com) 取得
- **Google**：從 [ai.google.dev](https://ai.google.dev) 取得

---

## 3. 快速開始（Dashboard）

推薦透過 AgentGazer Dashboard 進行整合。

### 步驟 1：啟動 AgentGazer

```bash
agentgazer start
```

在瀏覽器中開啟 [http://localhost:18800](http://localhost:18800)。

### 步驟 2：設定 Provider 金鑰

1. 前往 **Providers** 頁面
2. 點擊 **Add Provider**
3. 選擇你的 Provider（Anthropic、OpenAI 等）
4. 輸入 API 金鑰
5. 點擊 **Save**

### 步驟 3：OpenClaw 整合頁面

1. 點擊側邊欄的 **OpenClaw** 頁面
2. 確認你的 Provider 已列在「Prerequisites」下方
3. 設定 **Proxy Host**（預設：`localhost:18900`）
   - 若需從其他機器存取，請使用內網 IP（例如 `192.168.1.100:18900`）
4. 輸入 **Agent Name**（例如 `openclaw`）
5. 點擊 **Apply Configuration**

這會自動將設定寫入 `~/.openclaw/openclaw.json`。

### 步驟 4：重新啟動 OpenClaw

```bash
openclaw restart
```

### 步驟 5：發送測試訊息

透過 OpenClaw 發送任意訊息（Discord、Telegram 等）。這會在 AgentGazer 中建立 Agent。

### 步驟 6：設定模型路由

1. 前往 **Agents** → 點擊你的 Agent（例如 `openclaw`）
2. 在頂部找到 **Model Settings**
3. 針對 `agentgazer` provider 項目，設定：
   - **Model Override**：實際使用的模型（例如 `claude-sonnet-4-20250514`）
   - **Target Provider**：實際的 Provider（例如 `anthropic`）
4. 點擊 **Save**

現在所有 OpenClaw 請求都會路由到你設定的 Provider！

---

## 4. 架構說明

```
┌─────────────────────────────────────────────────────────────┐
│                        你的機器                               │
│                                                             │
│  ┌───────────────┐     ┌──────────────────┐                 │
│  │   OpenClaw    │────▶│  AgentGazer      │                 │
│  │               │     │  Proxy :18900    │                 │
│  │  設定為：       │     │                  │                 │
│  │  agentgazer/  │     │  1. 接收請求      │                 │
│  │  agentgazer-  │     │  2. 查詢 Model   │                 │
│  │  proxy        │     │     Override     │                 │
│  └───────────────┘     │  3. 路由到實際    │                 │
│                        │     Provider     │                 │
│                        │  4. 擷取指標      │                 │
│                        └────────┬─────────┘                 │
│                                 │                           │
│                     ┌───────────▼───────────┐               │
│                     │  LLM Provider APIs    │               │
│                     │  (Anthropic, OpenAI,  │               │
│                     │   Google 等)          │               │
│                     └───────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  AgentGazer Dashboard :18800             │               │
│  │  - 即時指標                                │               │
│  │  - Model Override 設定                    │               │
│  │  - 告警管理                                │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 運作原理

1. **OpenClaw** 發送請求到 `agentgazer` 虛擬 Provider
2. **AgentGazer Proxy** 在 `/agents/{agent}/agentgazer` 接收請求
3. Proxy 查詢該 Agent 的 **Model Override Rules**
4. 請求被轉換並轉發到實際的 Provider（例如 Anthropic）
5. 回應返回給 OpenClaw，同時非同步擷取指標
6. **Dashboard** 顯示即時成本、延遲和 Token 使用量

### 隱私保證

Proxy 只提取指標資料（Token 數量、模型名稱、延遲等）。**Prompt 內容不會被儲存或傳輸**。所有資料都保留在你的本地機器上。

### 這種方式的優點

| 功能 | 優點 |
|------|------|
| **動態切換** | 從 Dashboard 更換模型/Provider，無需編輯 OpenClaw 設定 |
| **集中金鑰管理** | API 金鑰安全儲存在 AgentGazer，不在設定檔中 |
| **統一監控** | 所有請求都出現在同一個 Agent 下，不論目標 Provider |
| **A/B 測試** | 輕鬆切換 Provider 來比較效能 |

---

## 5. 設定告警

整合完成後，為你的 OpenClaw Agent 設定告警。

### 建議的告警規則

| 類型 | 設定 | 用途 |
|------|------|------|
| **Agent Down** | 10 分鐘 | 偵測 OpenClaw 停止運作 |
| **Error Rate** | 15% / 10 分鐘 | 偵測 API 失敗 |
| **Budget** | $20/天 | 防止成本失控 |

### 透過 Dashboard 設定

1. 前往 **Alerts** 頁面
2. 點擊 **New Alert Rule**
3. 選擇 Agent：你的 OpenClaw Agent 名稱
4. 選擇規則類型並設定閾值
5. 輸入通知用的 Webhook URL
6. 點擊 **Save**

### 透過 API 設定

```bash
# Agent Down 告警
curl -X POST http://localhost:18800/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "agent_down",
    "config": { "duration_minutes": 10 },
    "webhook_url": "https://your-webhook.com/alerts"
  }'

# Budget 告警
curl -X POST http://localhost:18800/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "budget",
    "config": { "threshold": 20 },
    "webhook_url": "https://your-webhook.com/alerts"
  }'
```

---

## 6. 治理功能

從 Dashboard 控制 OpenClaw 的 LLM 使用：

| 功能 | 說明 | 位置 |
|------|------|------|
| **啟用/停用開關** | 停用 Agent 以封鎖所有請求 | Policy Settings |
| **預算限制** | 設定每日花費上限 | Policy Settings |
| **允許時段** | 限制可發出 LLM 呼叫的時間 | Policy Settings |
| **Kill Switch** | 偵測到無限迴圈時自動停用 | Kill Switch Settings |
| **Model Override** | 控制使用的模型/Provider | Model Settings |
| **Rate Limits** | 限制每時間視窗的請求數 | Rate Limit Settings |

在 **Agents** → **[你的 Agent]** 中設定。

---

## 7. 疑難排解

### 問題速查表

| 問題 | 解決方案 |
|------|---------|
| OpenClaw 呼叫未出現 | 確認 `baseUrl` 指向 `:18900`，重啟 OpenClaw |
| 「Provider agentgazer requires cross-provider override」 | 在 Dashboard 設定 Model Override（步驟 6） |
| 401 Unauthorized | 在 Dashboard → Providers 新增 Provider API 金鑰 |
| 沒有成本資料 | 模型可能不在定價表中（指標仍會擷取） |
| 連線被拒絕 | 確認 AgentGazer 正在運行（`agentgazer status`） |

### 詳細步驟

#### OpenClaw 呼叫未出現

1. 確認 AgentGazer 正在運行：
   ```bash
   curl http://localhost:18900/health
   ```

2. 檢查 OpenClaw 設定：
   ```bash
   cat ~/.openclaw/openclaw.json | grep baseUrl
   ```
   應該顯示 `http://localhost:18900/agents/...`

3. 修改設定後重啟 OpenClaw

#### Model Override 無法運作

1. 前往 **Agents** → 你的 Agent → **Model Settings**
2. 確保有一條針對 `agentgazer` provider 的規則
3. 同時設定 **Model Override** 和 **Target Provider**
4. Target Provider 必須已設定 API 金鑰

#### 事件出現但沒有成本資料

AgentGazer 使用內建的定價表。如果模型不在表中，成本會顯示為空，但其他指標仍會擷取。

支援的 Provider：OpenAI、Anthropic、Google、Mistral、DeepSeek、Moonshot、Zhipu、MiniMax、Baichuan

---

## 8. 進階：手動設定

如果你偏好手動編輯 `~/.openclaw/openclaw.json`：

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "agentgazer": {
        "baseUrl": "http://localhost:18900/agents/openclaw/agentgazer",
        "apiKey": "managed-by-agentgazer",
        "api": "openai-completions",
        "models": [
          { "id": "agentgazer-proxy", "name": "AgentGazer Proxy" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "agentgazer/agentgazer-proxy"
      }
    }
  }
}
```

### 欄位說明

| 欄位 | 說明 |
|------|------|
| `baseUrl` | 指向 AgentGazer Proxy 並包含 Agent 名稱 |
| `apiKey` | 任意非空值（Proxy 管理真正的金鑰） |
| `api` | 使用 `openai-completions` 以符合 OpenAI 相容格式 |
| `primary` | 模型識別碼，格式為 `provider/model` |

### 網路存取

如果 AgentGazer 運行在不同機器或你需要網路存取：

```json
{
  "baseUrl": "http://192.168.1.100:18900/agents/openclaw/agentgazer"
}
```

將 `192.168.1.100` 替換為你的 AgentGazer 主機 IP 位址。

---

## 9. 替代方案：直接 Provider 路由

如果你不想使用 Model Override，而是直接路由到 Provider：

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:18900/anthropic",
        "api": "anthropic-messages"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-sonnet-4-20250514"
      }
    }
  }
}
```

這種方式：
- 直接路由到特定 Provider（`/anthropic`、`/openai` 等）
- 需要透過 `agentgazer provider add` 儲存 Provider API 金鑰
- 無法從 Dashboard 動態切換 Provider
- 每個 Provider 需要在設定中各自設定

**支援的路徑前綴**：`/openai`、`/anthropic`、`/google`、`/mistral`、`/deepseek`、`/moonshot`、`/zhipu`、`/minimax`、`/baichuan`

---

## 附錄：快速啟動檢查表

- [ ] 安裝 AgentGazer（`npm install -g @agentgazer/cli`）
- [ ] 啟動 AgentGazer（`agentgazer start`）
- [ ] 開啟 Dashboard（[http://localhost:18800](http://localhost:18800)）
- [ ] 新增 Provider API 金鑰（Providers 頁面）
- [ ] 前往 OpenClaw 頁面並點擊 Apply Configuration
- [ ] 重啟 OpenClaw（`openclaw restart`）
- [ ] 發送測試訊息
- [ ] 設定 Model Override（Agents → 你的 Agent → Model Settings）
- [ ] 設定 Agent Down 告警（10 分鐘）
- [ ] 設定 Budget 告警（$20/天）
- [ ] 監控 Dashboard 確認數據正常流入
