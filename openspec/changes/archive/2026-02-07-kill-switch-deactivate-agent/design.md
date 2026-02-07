## Context

目前 Kill Switch 觸發時回傳 HTTP 429，但 agent 將此解讀為「稀後重試」，造成無限的 block-retry 迴圈。需要改為直接 deactivate agent，強制人工介入。

現有架構：
- `agent_policies` 表已有 `active` 欄位
- `checkAgentPolicy()` 已經會擋掉 inactive agent
- `loopDetector` 是 proxy 記憶體內的 singleton
- Server 和 Proxy 是分開的 process

## Goals / Non-Goals

**Goals:**
- Kill Switch 觸發時直接 deactivate agent
- 記錄 deactivation 原因（kill_switch vs manual）
- Activate 時自動清空 loop detector 窗口
- Dashboard 顯示被 Kill Switch 停用的標記

**Non-Goals:**
- 自動恢復機制（必須人工介入）
- 修改 loop detection 的評分邏輯
- 支援多 proxy instance 的窗口同步

## Decisions

### 1. Deactivation 欄位設計

**決定**: 在 `agent_policies` 表新增 `deactivated_by TEXT` 欄位

**替代方案考慮**:
- 用 events 表推斷（查詢是否有 kill_switch event）→ 查詢複雜，效能差
- 用 boolean `killed_by_kill_switch` → 不夠通用

**值域**: `'kill_switch'` | `'manual'` | `null`
- `null` = 預設（active 或從未被 deactivate）
- `'manual'` = 手動停用
- `'kill_switch'` = 被 Kill Switch 自動停用

### 2. Proxy-Server 通訊

**決定**: Proxy 直接寫入 DB 更新 agent policy

**理由**: Proxy 已經持有 DB connection（用於 policy check），不需要額外的 HTTP call

```
Kill Switch 觸發
      │
      ├──▶ updateAgentPolicy(db, agentId, { active: 0, deactivated_by: 'kill_switch' })
      ├──▶ 發送 Alert
      └──▶ 返回 inactive 回應
```

### 3. 清窗口的觸發點

**決定**: 在 Server 的 PATCH `/api/agents/:id` 當 `active` 從 0 變 1 時，呼叫 proxy 的清窗口 endpoint

**替代方案考慮**:
- Dashboard 直接呼叫 proxy → 需要 Dashboard 知道 proxy 地址
- Proxy 輪詢 DB 檢查 active 變化 → 複雜且延遲

**實作**:
1. Proxy 新增 `POST /internal/agents/:id/clear-window` endpoint
2. Server 在 activate 時呼叫此 endpoint
3. 如果 proxy 不可達，仍然完成 activate（窗口會在 TTL 後自動清理）

### 4. 回應格式

**決定**: 使用與手動 deactivate 相同的回應格式

現有 `checkAgentPolicy()` 回傳 `reason: "inactive"`，維持此行為。不需要區分是 kill switch 還是手動停用。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| Proxy 清窗口 endpoint 失敗 | 非關鍵路徑，activate 仍成功；窗口會在 TTL (24h) 後自動清理 |
| DB 更新失敗導致 agent 未停用 | 記錄錯誤，仍回傳 blocked response（至少擋住這次請求） |
| 多 proxy instance 窗口不同步 | Out of scope，目前假設單 proxy；文件說明此限制 |
