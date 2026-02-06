# 概覽

## 痛點

開發 AI Agent 很難，Debug 更難。

- **看不見** — LLM 呼叫像黑箱。出問題時只能翻 log 碰運氣。
- **成本失控** — Token 用量默默累積，收到帳單才發現爆了。
- **靜默失敗** — Agent 當掉或卡住沒通知，使用者比你先發現問題。
- **隱私疑慮** — 雲端觀測工具要你的 prompt 和 API key，很多場景不能接受。

## 解決方案

AgentTrace 是一個**本地優先**的 AI Agent 可觀測性平台。

```bash
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/install.sh | sh
agenttrace start
```

一條指令給你：

- **LLM 呼叫追蹤** — 每個請求記錄 token、延遲、成本、模型
- **即時儀表板** — 看到 Agent 正在做什麼
- **成本分析** — 按 Provider、Model、Agent 分類的花費
- **健康監控** — 基於心跳的狀態（healthy / degraded / down）
- **告警** — Webhook 和 Email 通知下線、錯誤、預算超標

所有資料留在你的機器。Prompt 和 API Key 永遠不會離開你的環境。

## 運作方式

兩種資料收集方式：

| 方式 | 說明 | 適合 |
|------|------|------|
| **Proxy** | 把 LLM client 指向 `localhost:4000`，零程式碼改動 | 既有專案、快速上手 |
| **SDK** | 在程式碼中手動呼叫 `track()` | 精細控制、自訂事件 |

```
┌─────────────────────────────────────────────────────────────┐
│                       你的機器                               │
│                                                             │
│  ┌──────────┐    ┌─────────────────┐                        │
│  │ AI Agent │───▶│ AgentTrace Proxy│───▶ LLM Provider       │
│  └──────────┘    │    (:4000)      │     (OpenAI 等)        │
│       │          └────────┬────────┘                        │
│       │ SDK               │                                 │
│       ▼                   ▼                                 │
│  ┌─────────────────────────────────┐                        │
│  │   Server (:8080) + Dashboard    │                        │
│  │         SQLite DB               │                        │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 支援的 Provider

| Provider | 自動偵測 |
|----------|----------|
| OpenAI | ✓ |
| Anthropic | ✓ |
| Google | ✓ |
| Mistral | ✓ |
| Cohere | ✓ |
| DeepSeek | ✓ |

## 專案結構

```
~/.agenttrace/
├── config.json     # 認證 Token、設定
├── data.db         # SQLite 資料庫（事件、Agent、告警）
└── lib/            # 安裝的套件（僅 curl 安裝）
```

AgentTrace 是一個 monorepo：

| 套件 | 說明 |
|------|------|
| `agenttrace` | CLI — 啟動 server、proxy、dashboard |
| `@agenttrace/server` | Express API + SQLite |
| `@agenttrace/proxy` | 透明 LLM proxy |
| `@agenttrace/sdk` | 手動追蹤用的 Client SDK |
| `@agenttrace/shared` | 型別、定價表、Provider 偵測 |
