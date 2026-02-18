## Why

版本管理有兩個問題：

1. **Root package.json 還是 `0.5.5`**，所有子 packages 已經是 `0.6.0`。`@agentgazer/server` 的 dependency 也引用 `@agentgazer/shared@0.5.5`
2. **Express v4 runtime 搭配 `@types/express@^5.0.0`**，型別定義不匹配，可能導致 TypeScript 錯誤

## What Changes

- 統一所有 package.json 版本號為 `0.6.0`
- 將 `@types/express` 降回 `^4.x` 或升級 Express 到 v5

## Capabilities

### Modified Capabilities

- `versioning`: 統一版本號
- `typescript-config`: 修正 type dependency mismatch

## Impact

- **package.json**: 多個檔案需要修改
- **npm install**: 需要重新安裝依賴
- **如果升級 Express v5**: 可能需要修改 middleware 和 route handler 的型別
