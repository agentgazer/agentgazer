## 1. 命令架構

- [x] 1.1 在 cli.ts 註冊 `events` 命令和 help text
- [x] 1.2 新增 commands/events.ts 處理 events 命令

## 2. 參數解析

- [x] 2.1 解析 --agent, --type, --provider 篩選參數
- [x] 2.2 解析 --since 時間範圍參數 (1h, 24h, 7d, 30d)
- [x] 2.3 解析 --limit 參數（預設 50，上限 1000）
- [x] 2.4 解析 --search 參數
- [x] 2.5 解析 --output 格式參數 (table, json, csv)
- [x] 2.6 解析 --follow 參數

## 3. API 呼叫

- [x] 3.1 讀取 config 取得 server URL 和 token
- [x] 3.2 組合查詢參數呼叫 GET /api/events
- [x] 3.3 處理錯誤（server 未啟動、認證失敗）

## 4. 輸出格式化

- [x] 4.1 實作 table 格式輸出（含 ANSI 顏色）
- [x] 4.2 實作 json 格式輸出
- [x] 4.3 實作 csv 格式輸出
- [x] 4.4 底部顯示統計資訊

## 5. Follow Mode

- [x] 5.1 實作 polling loop（每 3 秒）
- [x] 5.2 追蹤上次最新 timestamp，只顯示新 events
- [x] 5.3 處理 Ctrl+C 優雅退出
