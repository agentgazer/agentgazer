## Why

目前的 alert 機制有以下限制：
1. Cooldown 固定 15 分鐘，不可配置
2. 無法選擇一次性通知 vs 持續通知
3. 沒有恢復通知（條件恢復時不會通知）
4. 各 alert type 沒有明確的恢復條件定義
5. CLI 沒有 alert 管理命令

## What Changes

- Alert rules 新增可配置的重複通知設定
- 新增 state 狀態追蹤 (normal/alerting/fired)
- 新增恢復通知功能
- 各 alert type 實作明確的恢復條件
- CLI 新增 alert 子命令

## Capabilities

### New Capabilities
- `alert-state-machine`: Alert 狀態機，管理 normal/alerting/fired 狀態轉換
- `cli-alert-commands`: CLI alert 管理命令 (list, add, delete, reset)

### Modified Capabilities
- `alerting`: 增強現有 alert 評估邏輯，支援可配置重複間隔和恢復通知

## Impact

- `packages/server`: 修改 alert_rules schema、evaluator 邏輯
- `packages/cli`: 新增 alert 子命令
- `apps/dashboard-local`: 更新 alert 設定 UI（可選，本次可先不做）
