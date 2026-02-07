## Why

目前 Dashboard 沒有刪除 Agent 和 Provider 的功能。使用者無法清理不再使用的 Agent 或移除設定錯誤的 Provider，導致介面雜亂且資料累積。

## What Changes

- Agent 詳情頁新增 Delete Agent 按鈕，含確認對話框
- Provider 詳情頁新增 Delete Provider 按鈕，含確認對話框
- 新增 DELETE /api/agents/:id API endpoint
- 新增 DELETE /api/providers/:provider API endpoint
- 刪除時級聯清除相關資料（events, alerts, rate limits, model rules, kill switch settings）

## Capabilities

### New Capabilities

- `delete-agent`: 刪除 Agent 及其所有相關資料的功能
- `delete-provider`: 刪除 Provider 及其所有相關資料的功能

### Modified Capabilities

<!-- 無需修改現有 specs -->

## Impact

- `packages/server/src/routes/agents.ts` — 新增 DELETE endpoint
- `packages/server/src/routes/providers.ts` — 新增 DELETE endpoint（如果不存在則新增此檔案）
- `packages/server/src/db.ts` — 新增刪除相關資料的方法
- `apps/dashboard-local/src/pages/AgentDetail.tsx` — 新增刪除按鈕
- `apps/dashboard-local/src/pages/ProviderDetail.tsx` — 新增刪除按鈕
