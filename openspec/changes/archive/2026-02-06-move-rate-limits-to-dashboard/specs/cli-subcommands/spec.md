## REMOVED Requirements

### Requirement: Rate limit prompt in onboard
**Reason**: Rate limit 設定移至 Dashboard 管理，CLI 不再詢問
**Migration**: 使用者需在 Dashboard Agent Detail 頁面設定 rate limits

### Requirement: Rate limit prompt in providers set-api-key
**Reason**: Rate limit 設定移至 Dashboard 管理，CLI 不再詢問
**Migration**: 使用者需在 Dashboard Agent Detail 頁面設定 rate limits

## MODIFIED Requirements

### Requirement: Start command loads rate limits
CLI start 命令 SHALL 從 SQLite 讀取 rate limits 並傳給 Proxy，取代從 config.json 讀取。

#### Scenario: Start with database rate limits
- **WHEN** 執行 `agentgazer start`
- **THEN** 從 SQLite 讀取 rate limits 並傳給 Proxy

#### Scenario: Start with no rate limits configured
- **WHEN** SQLite 中沒有 rate limit 設定
- **THEN** Proxy 啟動時不套用任何 rate limit
