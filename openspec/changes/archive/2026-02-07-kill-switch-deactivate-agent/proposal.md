## Why

當 Kill Switch 偵測到 agent 進入無限迴圈時，目前回傳 HTTP 429 並附帶 `Retry-After: 60`。但 agent 會將此解讀為「服務忙碌，稍後重試」，導致它每 60 秒重發相同請求，形成無限的 block-retry 迴圈。正確的做法是直接 deactivate agent，強制人工介入處理。

## What Changes

- Kill Switch 觸發時直接將 agent 設為 inactive（`active = 0`）
- 新增 `deactivated_by` 欄位記錄停用原因（`'kill_switch'` | `'manual'` | `null`）
- Agent 被 activate 時自動清空 loop detector 的滑動窗口
- Dashboard 顯示「Deactivated by Kill Switch」標記
- 移除 Kill Switch 的 429 回應邏輯，改用標準的 inactive agent 回應

## Capabilities

### New Capabilities

_None - this is a refinement of existing kill-switch behavior_

### Modified Capabilities

- `kill-switch`: 改變觸發時的行為，從回傳 429 改為直接 deactivate agent

## Impact

- **packages/server/src/db.ts**: 新增 `deactivated_by` 欄位
- **packages/proxy/src/proxy-server.ts**: 修改 Kill Switch 觸發邏輯
- **packages/server/src/routes/agents.ts**: activate 時呼叫清窗口 API
- **packages/proxy**: 需要暴露清窗口的 API 或透過 server 呼叫
- **apps/dashboard-local**: 顯示不同的 deactivated 原因
