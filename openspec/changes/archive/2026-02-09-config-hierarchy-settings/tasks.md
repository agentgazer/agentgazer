## 1. Config Schema 重構

- [x] 1.1 更新 AgentGazerConfig interface (server, data, alerts sections)
- [x] 1.2 實作 readConfig migration (舊格式 → 新格式)
- [x] 1.3 更新 saveConfig 使用新結構
- [x] 1.4 更新 CLI 所有讀取 config 的地方 (port, proxyPort, autoOpen, retentionDays)

## 2. Settings API

- [x] 2.1 新增 routes/settings.ts
- [x] 2.2 實作 GET /api/settings (回傳 config 不含 token/providers)
- [x] 2.3 實作 PUT /api/settings (partial merge + 寫檔)
- [x] 2.4 Server startup 接收 configPath 參數

## 3. Dashboard Settings Page

- [x] 3.1 新增 Settings.tsx 頁面
- [x] 3.2 實作 Server 區塊 (port, proxyPort, autoOpen)
- [x] 3.3 實作 Data 區塊 (retentionDays)
- [x] 3.4 實作 Alert Defaults 區塊 (telegram, webhook)
- [x] 3.5 實作儲存邏輯 + restart required 提示
- [x] 3.6 新增 /settings route 到 App.tsx
- [x] 3.7 新增 Settings 連結到 sidebar

## 4. CLI Alert Defaults

- [x] 4.1 讀取 alerts.defaults 在 alert add 時
- [x] 4.2 --telegram 沒給 token/chatId 時使用 defaults
- [x] 4.3 --webhook 沒給 URL 時使用 defaults
- [x] 4.4 新的 telegram/webhook 值寫回 defaults (透過 Dashboard Settings)
