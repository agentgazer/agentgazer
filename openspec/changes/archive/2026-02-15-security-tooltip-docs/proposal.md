## Why

Security Shield 的 Dashboard UI 目前只顯示簡單的標籤（如 "System prompt override"），用戶無法得知每個規則實際檢測什麼內容、什麼情況會觸發、以及是否該開啟。需要為每個安全規則加上 tooltip 說明，並建立對應的文件頁面提供完整細節。

## What Changes

- 在 SecurityPage 每個 toggle 旁加上 info icon，hover 顯示 tooltip
- Tooltip 包含：簡短說明、觸發範例、連結到文件
- 新增 Security 文件頁面（英文/中文），詳細說明所有安全規則
- 更新 VitePress sidebar 加入 Security 文件連結

## Capabilities

### New Capabilities
- `security-tooltips`: Dashboard SecurityPage 的 tooltip 元件與內容
- `security-docs`: Security 功能的完整文件頁面（雙語）

### Modified Capabilities
<!-- No existing spec requirements are changing -->

## Impact

- `apps/dashboard-local/src/pages/SecurityPage.tsx` - 加入 tooltip 元件
- `apps/docs/en/guide/security.md` - 新文件
- `apps/docs/zh/guide/security.md` - 新文件
- `apps/docs/.vitepress/config.ts` - 更新 sidebar
