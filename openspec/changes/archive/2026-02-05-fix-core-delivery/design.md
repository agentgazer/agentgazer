## Context

AgentTrace 是一個 local-first AI agent 可觀測性工具。後端（server、proxy、SDK）功能完整且有測試覆蓋，但使用者實際碰到的交付層（CLI、Dashboard、SDK 預設值）有多處斷裂，導致 `npm install agenttrace` 後無法正常使用。

目前的問題：
1. CLI 的 npm package 不包含 dashboard 前端檔案 → 啟動後沒有 UI
2. Dashboard 引用 `last_heartbeat` 但 server 回傳 `last_heartbeat_at` → 頁面資料錯誤
3. SDK 預設 endpoint 指向不存在的 Supabase URL → 使用者不傳 endpoint 就壞掉
4. CLI 沒有子命令結構，沒有 onboard 流程 → 使用者不知道怎麼接 SDK
5. 舊的 Next.js dashboard 還在 repo 裡 → 造成混淆

## Goals / Non-Goals

**Goals:**
- `npm install -g agenttrace && agenttrace onboard && agenttrace start` 能走完
- Dashboard 在 localhost 有畫面、資料正確
- SDK 不傳 endpoint 也能連到本地 server
- 使用者知道怎麼把 SDK 接進自己的程式碼

**Non-Goals:**
- 重寫 Dashboard UI（功能增強留給後續）
- 新增 provider 支援
- 修改 server API 結構
- 支援遠端部署模式

## Decisions

### 1. Dashboard 打包方式：嵌入 CLI package

**選擇**：在 CLI 的 build 流程中，先 build dashboard-local，再把 `dist/` 複製到 CLI 的 `dist/dashboard/` 目錄下。CLI 的 `package.json` files 欄位包含此目錄。

**替代方案**：
- 打包進 server package → 但 server 是 library，不應該帶 UI 資產
- 首次啟動時下載 → 增加網路依賴，離線無法用

**理由**：CLI 是使用者的入口，dashboard 是 CLI 的一部分。一次安裝全部到位。

### 2. 欄位名稱修正：server 端改名

**選擇**：把 server 的 `/api/agents` 回傳從 `last_heartbeat_at` 改為 `last_heartbeat`，保持前後端一致。

**替代方案**：改前端 → 可以，但 `last_heartbeat` 比 `last_heartbeat_at` 更自然、更符合 API 慣例。

**理由**：API 是對外的介面，用更簡潔的名稱。DB column 名稱不需要變。

### 3. SDK 預設 endpoint：指向 localhost

**選擇**：`DEFAULT_ENDPOINT = "http://localhost:8080/api/events"`

**替代方案**：不給預設，強制要求傳入 → 增加使用者負擔，大多數情況就是 localhost。

**理由**：local-first 工具，預設就該能連。進階使用者可以覆蓋。

### 4. CLI 子命令：手寫路由，不加新依賴

**選擇**：在現有的 `parseArgs` 基礎上擴充，根據 `process.argv[2]` 分發到 `onboard`、`start`、`status` 等 handler。不引入 commander/yargs。

**替代方案**：用 commander → 功能更完整，但這裡只有 4-5 個子命令，不值得加依賴。

**理由**：保持零額外依賴。子命令很少，手寫足夠。

### 5. Onboard 流程：最精簡版

**選擇**：`agenttrace onboard` 做三件事：
1. 產生 token（如果還沒有）
2. 顯示 config 摘要（port、token）
3. 印出可複製的 SDK 程式碼片段

不做互動式選單（選 provider、設 port 等）。使用者要改 port 用 `agenttrace start --port 9090`。

**理由**：大部分設定用預設就好。Onboard 的價值是讓使用者知道怎麼把 SDK 接進去，不是填一堆設定。

### 6. 舊 Dashboard：直接刪除

**選擇**：移除整個 `apps/dashboard/` 目錄和 root package.json 中的相關引用。

**理由**：依賴 Supabase，與 local-first 架構不相容，沒有維護價值。

## Risks / Trade-offs

- **CLI package 變大** → dashboard dist 約 300KB（gzip 後 ~80KB），可接受
- **dashboard build 順序依賴** → turbo pipeline 已經處理依賴順序，需確認 CLI build 在 dashboard-local build 之後
- **刪除舊 dashboard** → 不可逆，但該 dashboard 已經無法運作（Supabase 依賴），沒有保留價值
