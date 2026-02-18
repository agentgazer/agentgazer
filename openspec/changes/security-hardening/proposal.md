## Why

AgentGazer 作為 LLM proxy 處理 API keys 和敏感資料，安全機制需要更嚴謹：

1. **Linux headless 的 AES-256-GCM key derivation 使用固定 salt** — `"agentgazer-machine-key-v1"` 是硬寫的常數，加密強度只靠 machineId + username 的唯一性，Docker 或共享主機上可被預測
2. **Data masking 預設全部關閉** — 使用者如果沒手動開啟，API key、信用卡號等敏感資料會直接透過 proxy 轉發給 LLM provider
3. **Webhook 沒有 HMAC 簽名** — 接收端無法驗證 webhook 來源是否為 AgentGazer

## What Changes

- 改用隨機 salt 存儲在 config 中，首次使用時生成
- 調整 `DEFAULT_SECURITY_CONFIG` 預設啟用關鍵 masking rules（API keys、credit cards）
- 為 webhook delivery 新增 HMAC-SHA256 簽名（`X-AgentGazer-Signature` header）

## Capabilities

### Modified Capabilities

- `secret-store`: 改善 Linux headless 加密機制
- `security-shield`: 調整預設 data masking 策略
- `webhook-alerts`: 新增 HMAC 簽名驗證

## Impact

- **Breaking change**: Data masking 預設行為改變，已有使用者的 security config 不受影響（只影響新安裝）
- **Config**: 新增 webhook secret 設定欄位
- **Migration**: 舊的固定 salt 加密需要 migration path
