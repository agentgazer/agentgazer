## Why

`npm install agenttrace` 之後執行 `agenttrace`，使用者看不到 Dashboard、SDK 連不上 server、前端欄位跟後端對不上。核心交付路徑是壞的 — 不修的話這個工具等於不能用。

## What Changes

- **Dashboard 打包**：將 dashboard-local 的建置產物打包進 CLI 發佈的 npm package，確保 `agenttrace start` 後 localhost 有畫面可看
- **前端欄位修正**：Dashboard 頁面引用 `agent.last_heartbeat`，但 server 回傳 `last_heartbeat_at`，修正為一致
- **SDK endpoint 修正**：移除指向 Supabase 的 placeholder，改為 `http://localhost:8080/api/events`
- **CLI 子命令**：將 `agenttrace` 改為子命令結構（`onboard`、`start`、`status`），取代現有的純 `--flags` 模式
- **Onboard 流程**：新增 `agenttrace onboard` 互動式首次設定，顯示 token 和 SDK 程式碼片段
- **移除舊 Dashboard**：刪除 `apps/dashboard/`（Next.js + Supabase），避免混淆

## Capabilities

### New Capabilities
- `cli-subcommands`: CLI 子命令架構（onboard / start / status / reset-token）
- `onboard-flow`: 互動式首次設定流程，產生 config 並顯示 SDK 使用方式

### Modified Capabilities
- `dashboard-bundling`: Dashboard 前端資產打包進 npm 發佈的 CLI package
- `dashboard-field-fix`: 修正前端與後端欄位名稱不一致
- `sdk-default-endpoint`: 修正 SDK 預設 endpoint

## Impact

- `packages/cli/` — 重構為子命令結構，新增 onboard 邏輯，調整 package.json files 設定
- `packages/sdk/src/agent-trace.ts` — 修改 DEFAULT_ENDPOINT
- `apps/dashboard-local/src/pages/` — 修正欄位名稱
- `apps/dashboard/` — 整個移除
- `packages/server/src/routes/agents.ts` — 可能需要調整回傳欄位名稱（或前端配合）
- 建置流程 — 需確保 dashboard build 在 CLI build 之前完成
