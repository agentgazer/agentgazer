## Why

文件有幾個缺口和不一致：

1. **README 引用的 `assets/dashboard-screenshot.png` 不存在** — GitHub 上顯示破圖
2. **`@agentgazer/mcp` 是完整的 package 但完全沒在 README 提到**
3. **`supabase/` 目錄是舊版雲端版本的殘留**，沒有說明也沒清掉，跟 "zero SaaS cost" 定位矛盾
4. **CLI help text 有 typo** — `deactive` 應該是 `deactivate`

## What Changes

- 補上或生成 dashboard screenshot
- 在 README 加入 MCP 功能說明
- 移除或歸檔 `supabase/` 目錄
- 修正 CLI typo

## Capabilities

### Modified Capabilities

- `documentation`: 修正文件缺口
- `cli`: 修正 typo

## Impact

- **README.md**: 更新
- **supabase/**: 移除（或移到 archive branch）
- **CLI**: 修改 help text
