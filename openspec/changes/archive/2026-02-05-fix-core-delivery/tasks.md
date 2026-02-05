## 1. 修正基礎問題

- [x] 1.1 修改 SDK `DEFAULT_ENDPOINT` 從 Supabase placeholder 改為 `http://localhost:8080/api/events`
- [x] 1.2 修改 server `/api/agents` 回傳欄位名稱：`last_heartbeat_at` → `last_heartbeat`
- [x] 1.3 確認 dashboard-local 所有頁面引用的欄位名稱與 server 回傳一致

## 2. Dashboard 打包

- [x] 2.1 在 CLI 的 build script 中加入步驟：複製 `apps/dashboard-local/dist/` 到 `packages/cli/dist/dashboard/`
- [x] 2.2 更新 CLI 的 `package.json` files 欄位，加入 `dist/dashboard/`
- [x] 2.3 更新 CLI 的 dashboard 路徑解析邏輯，優先從 `dist/dashboard/` 載入
- [x] 2.4 確認 turbo pipeline 中 CLI build 依賴 dashboard-local build

## 3. 移除舊 Dashboard

- [x] 3.1 刪除 `apps/dashboard/` 整個目錄
- [x] 3.2 從 root `package.json` workspaces 和 `turbo.json` 中移除 dashboard 的引用
- [x] 3.3 確認 `npm run build` 和 `npm test` 仍然通過

## 4. CLI 子命令結構

- [x] 4.1 重構 `packages/cli/src/cli.ts`：根據 `process.argv[2]` 分發到子命令 handler
- [x] 4.2 實作 `start` 子命令（搬移現有的啟動邏輯）
- [x] 4.3 實作 `status` 子命令（印出目前 config、port、db 路徑）
- [x] 4.4 將 `--reset-token` 改為 `reset-token` 子命令
- [x] 4.5 無參數或 `--help` 印出子命令列表

## 5. Onboard 流程

- [x] 5.1 實作 `onboard` 子命令：產生 token（如不存在）、印出 config 摘要
- [x] 5.2 印出可複製的 SDK TypeScript 程式碼片段，含 token 和 endpoint
- [x] 5.3 已有 config 時讀取現有設定，不重新產生 token

## 6. 驗證

- [x] 6.1 全部 build 通過
- [x] 6.2 全部測試通過
- [x] 6.3 手動測試：`agenttrace onboard` → `agenttrace start` → 瀏覽器開 localhost:8080 看到 dashboard
