## Why

AgentGazer 目前有三個 critical bugs 會影響核心功能的正確性：

1. **`security_blocked` event type 不在 DB CHECK constraint** — proxy 的 security filter 攔截請求後插入 `event_type: "security_blocked"`，但 `agent_events` table 的 CHECK constraint 不包含這個值，導致 SQLite 拋錯，security block 記錄遺失
2. **Proxy URL 預設值錯誤** — `packages/server/src/routes/agents.ts` 預設 `http://127.0.0.1:4000`，但 proxy 實際跑在 port `18900`，導致 agent 重新啟用時 loop detector window 永遠不會清除
3. **時區不一致** — `getDailySpend` 使用 local time，而 `getAllAgents` 的 today_cost 使用 UTC，在非 UTC 環境下預算限制跟 dashboard 顯示金額會對不上

## What Changes

- 在 DB migration 中加入 `security_blocked` 和 `security_event` 到 `agent_events` 的 CHECK constraint
- 修正 `AGENTGAZER_PROXY_URL` 預設值為 `http://127.0.0.1:18900`
- 統一 `getDailySpend` 和 `getAllAgents` 使用 UTC 時間計算「今日」

## Capabilities

### Modified Capabilities

- `database`: 修正 event_type CHECK constraint，新增 migration
- `proxy-integration`: 修正 server 呼叫 proxy 的預設 URL
- `budget-enforcement`: 統一時區計算邏輯

## Impact

- **DB**: 需要 ALTER TABLE 或重建 CHECK constraint（SQLite 限制）
- **Server**: `routes/agents.ts` 和 `db.ts` 修改
- **行為變更**: `getDailySpend` 改用 UTC 後，非 UTC 環境下的「今日花費」計算結果會改變
