## Context

AgentGazer 目前將所有 LLM 事件存入 SQLite `agent_events` 表。Overview 頁面有 "Recent Events" 但只顯示特殊事件（kill_switch, budget_warning 等），無法查看完整歷史。API 層面，`GET /api/events` 要求必填 `agent_id`，無法做全局查詢。

## Goals / Non-Goals

**Goals:**
- 提供完整的 logs 瀏覽體驗（篩選、分頁、搜尋）
- 自動清理過期資料，防止 DB 無限增長
- 優化 Recent Events 顯示密度

**Non-Goals:**
- 不存儲 request/response body（已經是 metadata only）
- 不做 log streaming/real-time tail
- 不做跨 agent 的 trace 關聯視圖

## Decisions

### 1. Logs 頁面設計

使用表格顯示，欄位：Time, Agent, Type, Provider, Model, Status, Cost

篩選器：
- Agent (dropdown, 從現有 agents 拉)
- Event Type (multi-select)
- Provider (dropdown)
- Time Range (preset: 1h, 24h, 7d, 30d, custom)

分頁：每頁 50 筆，cursor-based 或 offset-based。
選擇 offset-based，因為 SQLite 小資料量下效能足夠，實作簡單。

### 2. API 調整

`GET /api/events`:
- `agent_id` 改為 optional
- 新增 `offset` (default 0), `limit` (default 50, max 1000)
- Response 加入 `total` count

```json
{
  "events": [...],
  "total": 1234,
  "offset": 0,
  "limit": 50
}
```

### 3. Retention 機制

- 新增 config: `retention_days` (預設 30)
- 清理時機：
  1. Server 啟動時執行一次
  2. 每 24 小時定時執行
- 使用現有的 `cleanupOldData(db, days)` 函數
- 設定存入 `~/.agentgazer/config.json`

### 4. Recent Events 緊湊化

從 3 行改為 2 行：
```
🔴 Kill Switch · openclaw · 2m ago
   Agent loop detected (score: 4.0)
```

- 第一行：Icon + Type + Agent + Time（用 · 分隔）
- 第二行：Message
- 減少 padding，space-y-3 → space-y-2

## Risks / Trade-offs

**[Risk] 全局查詢可能慢** → 已有 timestamp index，加上 limit 限制，可接受

**[Risk] 大量 events 時分頁 total count 慢** → 可考慮 approximate count 或 cache，目前先用精確 count

**[Trade-off] offset-based vs cursor-based 分頁** → 選擇 offset-based 因為簡單，資料量大時再優化
