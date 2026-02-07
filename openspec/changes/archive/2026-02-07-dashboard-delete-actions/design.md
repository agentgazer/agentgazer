## Context

Dashboard 目前可以查看和管理 Agent 與 Provider，但缺少刪除功能。需要新增刪除 API 和 UI，並確保級聯刪除所有相關資料。

相關資料庫表：
- `agents` — Agent 主表
- `events` — Agent 事件（含 agent_id）
- `alert_rules` — 告警規則（含 agent_id）
- `alert_history` — 告警歷史（含 agent_id）
- `providers` — Provider 主表
- `agent_provider_settings` — Agent-Provider 設定（rate limits, model rules）

## Goals / Non-Goals

**Goals:**
- 提供安全的刪除機制，含確認對話框防止誤刪
- 級聯刪除所有相關資料，不留孤兒記錄
- 刪除後自動導航回列表頁

**Non-Goals:**
- 軟刪除 / 資料回收站
- 批量刪除

## Decisions

### 1. 確認對話框

使用簡單的 `window.confirm()` 對話框：
- "確定要刪除 Agent 'xxx' 嗎？此操作無法復原，所有相關資料都會被刪除。"
- "確定要刪除 Provider 'xxx' 嗎？此操作無法復原。"

**Rationale**: 簡單直接，不需要額外的 Modal 元件。

### 2. 級聯刪除順序

**Delete Agent:**
1. 刪除 `events` WHERE agent_id = ?
2. 刪除 `alert_history` WHERE agent_id = ?
3. 刪除 `alert_rules` WHERE agent_id = ?
4. 刪除 `agent_provider_settings` WHERE agent_id = ?
5. 刪除 `agents` WHERE id = ?

**Delete Provider:**
1. 刪除 `agent_provider_settings` WHERE provider = ?
2. 刪除 `providers` WHERE name = ?

**Rationale**: 先刪除子表，再刪除主表，避免 FK 約束問題。

### 3. API Response

- 成功：`204 No Content`
- 找不到：`404 Not Found`
- 刪除後 Dashboard 導航到列表頁

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 誤刪重要資料 | 確認對話框 + 明確警告訊息 |
| 大量 events 刪除很慢 | 可接受，這是清理操作 |
