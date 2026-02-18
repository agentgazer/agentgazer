## Why

AgentGazer 已有相當完整的測試覆蓋（proxy、server、shared、cli、mcp 都有測試），但沒有任何 GitHub Actions workflow 在 PR 或 push 時自動執行。目前唯一的 CI 是 Docker image 發佈和 docs 部署。這代表 regressions 不會被自動偵測。

## What Changes

- 新增 GitHub Actions workflow：在 PR 和 push to main 時自動跑 test、lint、type check
- 新增 build 驗證確保所有 packages 能成功編譯

## Capabilities

### New Capabilities

- `ci-test`: 自動化測試 pipeline
- `ci-lint`: 自動化 lint 檢查
- `ci-typecheck`: 自動化 TypeScript type check

## Impact

- **GitHub**: 新增 `.github/workflows/ci.yml`
- **PR**: 所有 PR 需要通過 CI 才能合併
- **Dependencies**: 可能需要調整 test scripts 以支援 CI 環境
