## Why

CLI onboard 流程詢問 rate limit 設定不直覺，使用者通常不知道要設什麼值。將 rate limit 設定移到 Dashboard，讓使用者可以在觀察實際使用狀況後再調整，更符合實際需求。

## What Changes

- 移除 CLI `onboard` 和 `providers set-api-key` 中的 rate limit 提示
- 新增 SQLite table `agent_rate_limits` 存儲 per-agent per-provider rate limits
- 新增 Server API endpoints 管理 rate limits
- 在 Dashboard Agent Detail 頁面新增 Rate Limits 設定區塊
- Proxy 改從 SQLite 讀取 rate limits（取代從 config.json 讀取）
- **BREAKING**: config.json 中的 `providers.*.rateLimit` 設定將被忽略

## Capabilities

### New Capabilities
- `agent-rate-limits`: Per-agent per-provider rate limit 管理，包含 CRUD API 和 Dashboard UI

### Modified Capabilities
- `cli-subcommands`: 移除 onboard/providers 中的 rate limit 提示

## Impact

- **packages/cli**: 移除 rate limit 相關提示和 config 處理
- **packages/server**: 新增 rate limits table 和 API routes
- **packages/proxy**: 改從 SQLite 讀取 rate limits，移除 config 依賴
- **apps/dashboard-local**: Agent Detail 頁面新增 Rate Limits 區塊
- **Migration**: 現有 config.json 中的 rate limit 設定需要使用者手動在 Dashboard 重新設定
