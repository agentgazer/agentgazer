## Context

CLI 已有多個查詢命令（agents, providers, stats），遵循一致的模式：呼叫 API、格式化輸出。events 命令將沿用相同模式。

## Goals / Non-Goals

**Goals:**
- 提供 CLI 查詢 events 的能力，參數設計直覺易用
- 輸出格式清晰，適合終端機閱讀和 pipe 處理
- 支援常用篩選條件

**Non-Goals:**
- 不做即時串流（follow mode 用 polling 實現）
- 不做互動式 TUI（保持簡單的命令列輸出）

## Decisions

### 1. 命令結構

```
agentgazer events [options]

Options:
  -a, --agent <name>      Filter by agent ID
  -t, --type <type>       Filter by event type
  -p, --provider <name>   Filter by provider
  -s, --since <duration>  Time range: 1h, 24h, 7d, 30d (default: 24h)
  -n, --limit <number>    Max events (default: 50, max: 1000)
  -o, --output <format>   Output: table, json, csv (default: table)
      --search <term>     Search in model/provider/error
  -f, --follow            Poll for new events every 3s
```

### 2. 輸出格式

**Table 格式（預設）：**
```
TIME                 AGENT       TYPE        PROVIDER   MODEL            STATUS  COST
2026-02-09 00:15:32  openclaw    completion  deepseek   deepseek-chat    200     $0.0012
2026-02-09 00:14:28  my-bot      error       openai     gpt-4o           500     -

Showing 2 of 128 events (last 24 hours)
```

- 時間格式：本地時間，精確到秒
- Model 欄位過長時截斷
- Cost 為 null 時顯示 `-`
- 底部顯示統計資訊

**JSON 格式：**
直接輸出 API response，方便 jq 處理

**CSV 格式：**
標準 CSV，適合匯出到試算表

### 3. Follow Mode

使用 polling 方式，每 3 秒查詢一次新 events。記住上次最新的 timestamp，只顯示更新的。按 Ctrl+C 退出。

### 4. API 呼叫

使用現有的 `GET /api/events` endpoint：
- 從 config.json 讀取 server URL 和 token
- 組合查詢參數
- 處理錯誤（server 未啟動、認證失敗等）

## Risks / Trade-offs

**[Risk] Server 未啟動** → 顯示友善錯誤訊息，提示執行 `agentgazer start`

**[Trade-off] Follow mode 用 polling** → 簡單實作，3 秒延遲可接受
