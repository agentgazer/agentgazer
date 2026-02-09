## 1. API 調整

- [x] 1.1 修改 GET /api/events：agent_id 改為 optional
- [x] 1.2 新增 offset/limit 參數支援分頁
- [x] 1.3 Response 加入 total count 欄位

## 2. Auto Retention

- [x] 2.1 在 config.json 新增 retention_days 設定（預設 30）
- [x] 2.2 Server 啟動時執行 cleanupOldData
- [x] 2.3 新增 24 小時定時清理 scheduler

## 3. Dashboard - Recent Events 緊湊化

- [x] 3.1 修改 RecentEventsTimeline：改為 2 行格式
- [x] 3.2 第一行顯示 Icon · Type · Agent · Time
- [x] 3.3 減少 padding 和 spacing

## 4. Dashboard - Logs 頁面

- [x] 4.1 新增 LogsPage 元件和路由 /logs
- [x] 4.2 實作 events 表格（Time, Agent, Type, Provider, Model, Status, Cost）
- [x] 4.3 實作篩選器（Agent dropdown, Event Type, Provider, Time Range）
- [x] 4.4 實作分頁控制元件
- [x] 4.5 實作 Export 按鈕（CSV）
- [x] 4.6 Overview 的 Recent Events 加上 "View All →" 連結
