# 概覽

## 痛點

開發 AI Agent 很難，Debug 更難。

- **看不見** — LLM 呼叫像黑箱。出問題時只能翻 log 碰運氣。
- **成本失控** — Token 用量默默累積，收到帳單才發現爆了。
- **靜默失敗** — Agent 當掉或卡住沒通知，使用者比你先發現問題。
- **隱私疑慮** — 雲端觀測工具要你的 prompt 和 API key，很多場景不能接受。

## 解決方案

AgentGazer 是一個**本地優先**的 AI Agent 治理平台。

```bash
curl -fsSL https://raw.githubusercontent.com/agentgazer/agentgazer/main/scripts/install.sh | sh
agentgazer start
```

一條指令給你：

- **LLM 呼叫追蹤** — 每個請求記錄 token、延遲、成本、模型
- **即時儀表板** — 看到 Agent 正在做什麼
- **成本分析** — 按 Provider、Model、Agent 分類的花費
- **健康監控** — 基於心跳的狀態（healthy / degraded / down）
- **告警** — Webhook 和 Email 通知下線、錯誤、預算超標

所有資料留在你的機器。Prompt 和 API Key 永遠不會離開你的環境。

## 運作方式

把 LLM client 指向 AgentGazer Proxy（`localhost:18900`），零程式碼改動。

```
┌─────────────────────────────────────────────────────────────┐
│                       你的機器                               │
│                                                             │
│  ┌──────────┐    ┌─────────────────┐                        │
│  │ AI Agent │───▶│ AgentGazer Proxy│───▶ LLM Provider       │
│  └──────────┘    │    (:18900)      │     (OpenAI 等)        │
│                  └────────┬────────┘                        │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────┐                        │
│  │   Server (:18880) + Dashboard    │                        │
│  │         SQLite DB               │                        │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## API Key 託管

儲存一次，到處使用：

```bash
agentgazer providers set openai sk-xxx
agentgazer providers set anthropic sk-ant-xxx
```

金鑰在本機加密儲存（AES-256-GCM），永遠不會離開你的機器。當你使用 Proxy 的路徑前綴路由（`/openai/...`、`/anthropic/...`）時，金鑰會自動注入請求 — 不需要在每個 Agent 中分別設定。

```typescript
// 程式碼中不需要 API Key — Proxy 自動注入
const openai = new OpenAI({
  baseURL: "http://localhost:18900/openai/v1",
  apiKey: "dummy",  // 會被儲存的金鑰取代
});
```

這也讓金鑰輪換變得簡單：用 `providers set` 更新一次，所有 Agent 立即使用新金鑰。

多個 Agent 可以共用同一個 Proxy 和 API Key，同時分開追蹤用量 — 只要在請求中加上 `x-agent-id` header。

## 支援的 Provider

| Provider | 自動偵測 |
|----------|----------|
| OpenAI | ✓ |
| Anthropic | ✓ |
| Google | ✓ |
| Mistral | ✓ |
| DeepSeek | ✓ |
| Moonshot | ✓ |
| Zhipu（智譜） | ✓ |
| MiniMax | ✓ |
| Baichuan（百川） | ✓ |

## 專案結構

```
~/.agentgazer/
├── config.json     # 認證 Token、設定
├── data.db         # SQLite 資料庫（事件、Agent、告警）
└── lib/            # 安裝的套件（僅 curl 安裝）
```

AgentGazer 是一個 monorepo：

| 套件 | 說明 |
|------|------|
| `agentgazer` | CLI — 啟動 server、proxy、dashboard |
| `@agentgazer/server` | Express API + SQLite |
| `@agentgazer/proxy` | 透明 LLM proxy |
| `@agentgazer/shared` | 型別、定價表、Provider 偵測 |
