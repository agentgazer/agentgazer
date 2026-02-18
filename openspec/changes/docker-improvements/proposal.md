## Why

Dockerfile 有幾個安全和功能問題：

1. **Container 以 root 執行** — 沒有 `USER` directive，違反 container security best practice
2. **License label 錯誤** — 寫 `MIT` 但專案實際是 `AGPL-3.0`
3. **MCP package 未被 copy 進 production image** — build stage 有 mcp 但 production stage 缺少
4. **沒有 HEALTHCHECK** — orchestrator 無法偵測 container 是否健康

## What Changes

- 新增非 root user 執行
- 修正 license label
- 將 MCP package dist 複製進 production image
- 新增 HEALTHCHECK instruction

## Capabilities

### Modified Capabilities

- `docker`: 修正 Dockerfile 安全性和完整性

## Impact

- **Dockerfile**: 修改
- **docker-compose.yml**: 可能需要調整 volume mount 路徑（非 root user 的 home 不同）
- **Breaking**: 如果使用者依賴 root user 的路徑 (`/root/.agentgazer`)，需要 migration
