## Context

目前 agents 表有 `status` 和 `last_heartbeat_at` 欄位，但：
- `status` 只會在收到 heartbeat 時設為 healthy，其他狀態從未被設定
- Proxy 用戶不發 heartbeat，永遠卡在 unknown
- `last_heartbeat_at` 只有 SDK heartbeat() 會更新，但 `updated_at` 已經在每次事件時更新

Agents 列表目前只顯示事件數量，缺乏成本和 token 用量的可見性。

## Goals / Non-Goals

**Goals:**
- 移除無意義的 status 概念，簡化資料模型
- 讓 Agents 列表一眼就能看出哪個 agent 用量最高
- 保持 agent_down alert 功能，但基於實際活動時間

**Non-Goals:**
- 不重新設計 alert 系統
- 不改變 SDK API（heartbeat() 保留）

## Decisions

### 1. 移除 status 和 last_heartbeat_at 欄位

**決定**: 直接從 schema 移除，不做軟刪除或 deprecation

**理由**:
- 這些欄位從未有可靠的值
- 沒有外部系統依賴這些欄位
- `updated_at` 已經提供足夠的活動追蹤

**替代方案考慮**:
- 保留欄位但停止使用 → 增加混淆，不採用

### 2. agent_down alert 改用 updated_at

**決定**: evaluator 中的 `evaluateAgentDown()` 改查 `updated_at` 而非 `last_heartbeat_at`

**理由**:
- `updated_at` 在每次事件（包括 proxy 的 llm_call）都會更新
- 語義更正確：「沒有活動」而非「沒有 heartbeat」

### 3. Agents 列表新增統計欄位

**決定**: API 回傳 total_tokens, total_cost, today_cost，由 SQL 聚合計算

**SQL 策略**:
```sql
SELECT
  a.agent_id,
  a.active,
  a.updated_at,
  COALESCE(SUM(e.tokens_total), 0) AS total_tokens,
  COALESCE(SUM(e.cost_usd), 0) AS total_cost,
  COALESCE(SUM(CASE WHEN e.timestamp >= ? THEN e.cost_usd ELSE 0 END), 0) AS today_cost
FROM agents a
LEFT JOIN agent_events e ON a.agent_id = e.agent_id
GROUP BY a.agent_id
```

**理由**:
- 一次查詢取得所有資料，避免 N+1
- today_cost 用參數傳入今日 UTC 00:00

### 4. Active toggle 直接在列表操作

**決定**: 列表中顯示 toggle，呼叫 `PUT /api/agents/:id/policy` 更新 active 狀態

**理由**:
- 已有 policy API，不需新建 endpoint
- 減少進入詳細頁的需求

## Risks / Trade-offs

**[Breaking Change]** API 回傳格式變更 → 這是 local-first 工具，沒有外部 API 消費者

**[Migration]** 現有資料庫需要 migration → SQLite 的 ALTER TABLE DROP COLUMN 在新版支援，舊版可用 recreate table 策略

**[Performance]** 列表查詢加入聚合 → 加上適當的 index，資料量不大應該可接受
