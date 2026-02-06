## Context

AgentGazer 目前是純觀察性工具：Proxy 攔截 LLM 請求、提取指標、轉發請求。Server 和 Proxy 在同一個 process 運行但各自獨立，Proxy 不存取 DB。

現在要讓 Proxy 能根據 DB 中的 policy 設定決定是否允許請求通過。

## Goals / Non-Goals

**Goals:**
- 每個 Agent 可獨立設定：active/inactive、每日預算上限、允許時段
- 違規請求被攔截，回傳格式正確的假 LLM 回應
- Dashboard 可設定和查看 policy
- 被擋的請求記錄為 event，提供統計資料

**Non-Goals:**
- Model 切換功能（與現有 path routing 衝突，暫時擱置）
- 跨日預算（只做當日預算）
- 複雜的時區設定（使用 Server 本地時間）

## Decisions

### 1. Proxy 直接存取 DB（共用 DB instance）

**決定**：CLI 啟動時建立 DB instance，同時傳給 Server 和 Proxy。

**理由**：
- 每次請求只需一個 DB query，延遲 < 1ms
- 不需要維護 cache 或處理 cache 失效
- 資料保證一致

**替代方案**：
- Proxy 呼叫 Server API：增加 ~5-20ms 延遲
- 記憶體共享 Policy Cache：需要維護一致性

### 2. Agent 識別採用混合模式

**決定**：優先順序
1. `x-agent-id` header
2. `/agents/{id}/provider/...` 路徑
3. 無識別資訊 → 使用 "default" agent

**理由**：
- 向後相容：現有設定繼續運作（歸類到 default）
- 彈性：用戶選擇偏好的識別方式
- 漸進式：可以逐步遷移

### 3. 當日花費即時計算

**決定**：每次請求時 SUM 當日 agent_events 的 cost_usd。

**理由**：
- 100% 準確，不需要維護預計算欄位
- SQLite + index 查詢應該足夠快
- 避免日期切換重置邏輯

**替代方案**：
- 維護 daily_spend 欄位：更快但需要處理一致性

### 4. 假 LLM 回應格式

**決定**：根據偵測到的 provider 回傳對應格式的假回應。

```javascript
// OpenAI 格式
{
  "id": "blocked-xxxxx",
  "object": "chat.completion",
  "choices": [{
    "message": { "role": "assistant", "content": "⚠️ AgentGazer: ..." },
    "finish_reason": "stop"
  }]
}

// Anthropic 格式
{
  "id": "blocked-xxxxx",
  "type": "message",
  "role": "assistant",
  "content": [{ "type": "text", "text": "⚠️ AgentGazer: ..." }],
  "stop_reason": "end_turn"
}
```

### 5. 時區使用 Server 本地時間

**決定**：allowed_hours 使用 Server 本地時間，Dashboard 顯示 UTC offset。

**理由**：
- 個人本地工具，本地時間最直覺
- 避免時區轉換複雜度

### 6. 被擋請求記錄為 blocked event

**決定**：新增 event_type: 'blocked'，包含 block_reason tag。

**理由**：
- 可統計有多少請求被擋
- 展示產品價值
- 幫助用戶調整 policy

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 每次請求都 query DB 可能影響效能 | SQLite read 很快 (< 1ms)；未來可加 cache |
| 假回應可能讓 Agent 行為異常 | 訊息清楚標明原因；用戶可選擇直接拒絕 |
| 當日花費 SUM 在事件多時變慢 | 加 index；必要時改為預計算欄位 |
| default agent 可能收集到混雜資料 | Dashboard 引導用戶區分 agent |

## Data Model Changes

```sql
-- agents 表新增欄位
ALTER TABLE agents ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN budget_limit REAL;  -- NULL = 無限制
ALTER TABLE agents ADD COLUMN allowed_hours_start INTEGER;  -- 0-23, NULL = 無限制
ALTER TABLE agents ADD COLUMN allowed_hours_end INTEGER;    -- 0-23, NULL = 無限制

-- agent_events 新增 event_type
-- 已有: 'llm_call', 'completion', 'heartbeat', 'error', 'custom'
-- 新增: 'blocked'
```

## API Changes

```
GET  /api/agents/:agentId/policy    -- 取得 policy
PUT  /api/agents/:agentId/policy    -- 更新 policy
GET  /api/agents/:agentId/stats     -- 包含 blocked 統計
```
