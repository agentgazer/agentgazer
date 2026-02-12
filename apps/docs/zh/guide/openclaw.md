# OpenClaw 整合指南

> 使用 AgentGazer 監控你的 OpenClaw 個人 AI 助手 — 一鍵設定，完整掌控

## 概述

[OpenClaw](https://openclaw.ai) 是一個開源的個人 AI 助手。將 OpenClaw 的 LLM 請求經由 AgentGazer 路由後，你可以獲得：

- **成本追蹤** — 清楚知道每次對話花費多少
- **延遲監控** — 即時發現效能問題
- **錯誤告警** — API 呼叫失敗時立即通知
- **預算控制** — 設定每日花費上限

## 快速開始（Dashboard）

最簡單的整合方式是透過 AgentGazer Dashboard。

### 步驟 1：啟動 AgentGazer

```bash
agentgazer start
```

### 步驟 2：設定 Provider

1. 開啟 Dashboard [http://localhost:18880](http://localhost:18880)
2. 前往 **Providers** 頁面
3. 新增你的 LLM Provider API 金鑰（Anthropic、OpenAI 等）

### 步驟 3：OpenClaw 整合頁面

1. 點擊側邊欄的 **OpenClaw** 頁面
2. 確認你的 Provider 已列在「Prerequisites」下方
3. 設定 **Proxy Host**（預設：`localhost:18900`，內網存取請使用內網 IP）
4. 輸入 **Agent Name**（例如 `openclaw`）
5. 點擊 **Apply Configuration**

這會自動寫入 `~/.openclaw/openclaw.json`。

### 步驟 4：重啟 OpenClaw

```bash
openclaw restart
```

### 步驟 5：發送測試訊息

透過 OpenClaw 發送一則測試訊息（Discord、Telegram 等），然後檢查 **Agents** 頁面 — 你的 OpenClaw agent 應該會出現。

### 步驟 6：設定模型路由

1. 前往 **Agents** → **openclaw** → **Model Settings**
2. 針對 `agentgazer` provider，設定：
   - **Model Override**：實際使用的模型（例如 `claude-sonnet-4-20250514`）
   - **Target Provider**：實際的 provider（例如 `anthropic`）

## 運作原理

```
┌─────────────────────────────────────────────────────────┐
│                      你的機器                             │
│                                                          │
│  ┌─────────────┐     ┌──────────────────┐               │
│  │  OpenClaw   │────▶│  AgentGazer      │               │
│  │             │     │  Proxy :18900    │               │
│  │  baseUrl →  │     │                  │               │
│  │  :18900     │     │  自動擷取：        │               │
│  └─────────────┘     │  - tokens        │               │
│                      │  - cost          │               │
│                      │  - latency       │               │
│                      └────────┬─────────┘               │
│                               │                         │
│                   ┌───────────▼───────────┐             │
│                   │  LLM Provider APIs    │             │
│                   │  (Anthropic, OpenAI)  │             │
│                   └───────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

Proxy 攔截請求、提取指標、再轉發到真正的 Provider。**Prompt 內容不會被儲存** — 只記錄 token 數量、延遲和成本。

## 設定告警

整合完成後，為你的 OpenClaw agent 設定告警：

1. 前往 **Alerts** 頁面
2. 點擊 **New Alert Rule**
3. 選擇 agent：`openclaw`

### 建議的告警規則

| 類型 | 設定 | 用途 |
|------|------|------|
| **Agent Down** | 10 分鐘 | 偵測 OpenClaw 停止運作 |
| **Error Rate** | 15% / 10 分鐘 | 偵測 API 失敗 |
| **Budget** | $20/天 | 防止成本失控 |

## 治理功能

從 Dashboard 控制 OpenClaw 的 LLM 使用：

| 功能 | 說明 |
|------|------|
| **啟用/停用開關** | 停用 agent 以封鎖所有請求 |
| **預算限制** | 設定每日花費上限 |
| **允許時段** | 限制可發出 LLM 呼叫的時間 |
| **Kill Switch** | 偵測到無限迴圈時自動停用 |
| **模型覆寫** | 強制使用較便宜的模型 |

在 **Agents** → **openclaw** → **Policy Settings** 中設定。

## 疑難排解

| 問題 | 解決方案 |
|------|---------|
| OpenClaw 呼叫未出現 | 確認 `baseUrl` 指向 `:18900`，重啟 OpenClaw |
| 401 Unauthorized | 執行 `agentgazer provider add <provider>` 儲存 API 金鑰 |
| 沒有成本資料 | 模型可能不在定價表中（指標仍會擷取） |
| 連線被拒絕 | 確認 AgentGazer 正在執行（`agentgazer doctor`） |

## 進階：手動設定

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

### 運作方式

1. OpenClaw 將所有請求發送到 `agentgazer` provider
2. Proxy 在 `/agents/openclaw/agentgazer` 接收請求
3. AgentGazer 查找該 agent 的 **Model Override Rules** 並路由到實際的 provider

### 設定模型路由

套用設定後，在 Dashboard 中設定路由：

1. 前往 **Agents** → **openclaw**（首次請求後出現）
2. 點擊 **Model Settings**
3. 針對 `agentgazer` provider 項目，設定：
   - **Model Override**：實際使用的模型（例如 `claude-sonnet-4-20250514`）
   - **Target Provider**：實際的 provider（例如 `anthropic`）

這讓你可以不用編輯 OpenClaw 設定檔就能更換使用的模型/provider。

### API 金鑰處理

將 `apiKey` 設為任意非空值（例如 `"managed-by-agentgazer"`）。Proxy 會注入透過 `agentgazer provider add` 儲存的真實金鑰。
