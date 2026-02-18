## Context

AgentGazer 是內網 AI Agent 可觀測性平台，支援多台裝置透過一台中央 server 存取 LLM。目前 Agent 無法感知自己的資源消耗，需要透過 MCP 讓 Agent 能夠自我查詢。

MCP (Model Context Protocol) 是 Anthropic 推出的協定，讓 AI 助手能夠存取外部工具和資料。Host App (如 OpenClaw、Claude Desktop) 會在啟動時 spawn 所有設定的 MCP servers，整個 session 期間保持運行。

## Goals / Non-Goals

**Goals:**
- 讓 AI Agent 能查詢自己的 token 用量、花費、預算狀態
- 支援本機和遠端場景（內網多裝置共用一台 AgentGazer）
- 提供輕量 `@agentgazer/mcp` 套件，遠端 Agent 不需安裝完整 CLI
- 整合 OpenClaw 設定流程，自動加入 MCP server 設定

**Non-Goals:**
- Agent 自動切換模型省錢（決策成本悖論 — 貴的模型決定用便宜的模型）
- MCP over HTTP/SSE transport（使用標準 stdio，Host App spawn process）
- Per-agent token 權限管理（MVP 使用現有 dashboard token）

## Decisions

### 1. 統一使用 HTTP API 查詢（不直接讀 SQLite）

**選擇**: MCP server 透過 HTTP 呼叫 AgentGazer API

**理由**:
- 本機和遠端邏輯完全相同（只是 endpoint 不同）
- 支援內網多裝置場景
- 重用現有 API，無需重複 DB 查詢邏輯
- 避免 SQLite 跨 process 問題

**Trade-off**: 需要 AgentGazer server 在跑才能使用 MCP

```
┌─────────────────┐         ┌─────────────────┐
│  agentgazer-mcp │──HTTP──▶│ AgentGazer API  │
│    (stdio)      │         │ :18880          │
└─────────────────┘         └─────────────────┘
```

### 2. 獨立輕量套件 @agentgazer/mcp

**選擇**: 新增 `packages/mcp/` 套件，發布為 `@agentgazer/mcp`

**理由**:
- 遠端 Agent 只需 MCP 功能，不需要完整 server/proxy/dashboard
- `@agentgazer/cli` (~1.3MB) vs `@agentgazer/mcp` (~50KB)
- CLI 可以依賴 MCP 套件，提供 `agentgazer mcp` 子命令

**結構**:
```
packages/mcp/
├── package.json          # @agentgazer/mcp
├── src/
│   ├── index.ts          # exports
│   ├── server.ts         # MCP server (stdio)
│   ├── client.ts         # HTTP client for AgentGazer API
│   └── tools/
│       ├── get-cost.ts
│       ├── get-token-usage.ts
│       ├── get-budget-status.ts
│       ├── estimate-cost.ts
│       └── whoami.ts
└── bin/
    └── agentgazer-mcp.ts # CLI entry
```

### 3. Agent 識別透過環境變數

**選擇**: MCP server 啟動時讀取 `AGENTGAZER_AGENT_ID` 環境變數

**理由**:
- 設定時決定身份，不需 runtime 認證流程
- 簡單、明確
- 一個 Host 設定 = 一個 Agent 身份

**設定範例**:
```json
{
  "mcpServers": {
    "agentgazer": {
      "command": "agentgazer-mcp",
      "env": {
        "AGENTGAZER_ENDPOINT": "http://localhost:18880",
        "AGENTGAZER_TOKEN": "ag_xxx",
        "AGENTGAZER_AGENT_ID": "dev-machine-1"
      }
    }
  }
}
```

### 4. OpenClaw mcpServers deep merge

**選擇**: 只更新 `mcpServers.agentgazer`，保留其他 MCP servers

**理由**:
- 用戶可能已有其他 MCP servers（filesystem, github 等）
- 不能覆蓋整個 mcpServers section

**實作**:
```typescript
config.mcpServers = {
  ...config.mcpServers,      // 保留現有
  agentgazer: { ... }        // 只加/更新這個
};
```

### 5. MVP Tools 範圍

**選擇**: 5 個 tools 專注成本感知

| Tool | 說明 |
|------|------|
| `get_token_usage` | 查詢 token 用量 |
| `get_cost` | 查詢花費金額 |
| `get_budget_status` | 預算剩餘 / 已用百分比 |
| `estimate_cost` | 預估操作成本 |
| `whoami` | 當前 agent 身份資訊 |

**理由**:
- 足以支撐「成本感知 Agent」核心場景
- 不包含模型切換（決策成本悖論）
- 後續可擴展更多 tools

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Server 沒跑時 MCP 無法使用 | 啟動時檢查連線，給清楚錯誤訊息 |
| Token 暴露在環境變數 | 與現有 API token 機制一致，非新風險 |
| OpenClaw config 格式不符預期 | 防禦性 parsing，保留未知 keys |
| MCP SDK 版本相容性 | 鎖定穩定版本，定期更新 |
