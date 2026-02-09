# OpenClaw 整合指南

> 使用 AgentGazer 監控你的 OpenClaw 個人 AI 助手 — 一鍵設定，完整可觀測性

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

1. 開啟 Dashboard [http://localhost:18800](http://localhost:18800)
2. 前往 **Providers** 頁面
3. 新增你的 LLM Provider API 金鑰（Anthropic、OpenAI 等）

### 步驟 3：OpenClaw 整合頁面

1. 點擊側邊欄的 **OpenClaw** 頁面
2. 確認你的 Provider 已列在「Prerequisites」下方
3. 輸入 **Agent Name**（例如 `openclaw`）
4. 從下拉選單選擇 **Default Model**
5. 點擊 **Apply Configuration**

這會自動寫入 `~/.openclaw/openclaw.json`。

### 步驟 4：重啟 OpenClaw

```bash
openclaw restart
```

### 步驟 5：驗證

透過 OpenClaw 發送一則測試訊息（Discord、Telegram 等），然後檢查 **Agents** 頁面 — 你的 OpenClaw agent 應該會出現並顯示請求資料。

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
      "anthropic-traced": {
        "baseUrl": "http://localhost:18900/agents/openclaw/anthropic",
        "apiKey": "managed-by-agentgazer",
        "api": "anthropic-messages",
        "models": [
          { "id": "claude-sonnet-4-20250514", "name": "claude-sonnet-4-20250514" }
        ]
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

### URL 格式

```
http://localhost:18900/agents/{agent-name}/{provider}
```

- `{agent-name}` — 在 AgentGazer 中識別此 agent（例如 `openclaw`）
- `{provider}` — Provider 名稱：`anthropic`、`openai`、`google` 等

### 支援的 Provider

| Provider | API 類型 |
|----------|----------|
| `anthropic` | `anthropic-messages` |
| `openai` | `openai-completions` |
| `google` | `google-generative-ai` |
| 其他 | `openai-completions`（OpenAI 相容） |

### API 金鑰處理

將 `apiKey` 設為任意非空值（例如 `"managed-by-agentgazer"`）。Proxy 會注入透過 `agentgazer provider add` 儲存的真實金鑰。
