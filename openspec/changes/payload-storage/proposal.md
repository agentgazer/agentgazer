# Proposal: Request/Response Body Storage

## Problem

目前 AgentGazer 只記錄 LLM 請求的 metrics（tokens, cost, latency），不保留實際的 request/response body。這限制了：

1. **Kill Switch 功能** - 需要分析 body 來檢測循環，但目前只能用 simhash 做近似比對
2. **Debugging** - 出問題時無法回溯完整對話
3. **Audit** - 沒有完整記錄可供審計

## Solution

新增 payload 儲存機制，分為三層：

### 1. Memory Buffer (給 Kill Switch)
- 每個 agent 在記憶體中保留最近 N 筆 body（預設 50）
- 用於 kill switch 的 loop detection
- 重啟會丟失（可接受）

### 2. Archive (給用戶分析)
- 可選功能，透過 Settings 開關
- 存到獨立的 `payloads.db`（與主 DB 分離）
- 有獨立的 retention 設定
- 非同步 batch 寫入，不影響 proxy 效能

### 3. Evidence (永久保留)
- Kill switch 觸發時，自動把相關的 buffer 資料存為 evidence
- 關聯到 event_id
- 不受 retention 清理影響

## Architecture

```
~/.agentgazer/
├── data.db          # 主 DB (events, agents, alerts)
└── payloads.db      # Payload DB (分離，可能很大)
```

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Memory     │     │   Archive    │     │   Evidence   │
│   Buffer     │     │  (optional)  │     │  (永久)      │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ Per-agent    │     │ Batch write  │     │ Pinned       │
│ Rolling 50   │────▶│ Async IO     │     │ 關聯 event   │
│ 記憶體       │     │ Retention    │     │ Kill switch  │
└──────────────┘     └──────────────┘     └──────────────┘
        │                                        ▲
        │         Kill Switch 觸發               │
        └────────────────────────────────────────┘
```

## Settings

```json
{
  "payload": {
    "enabled": false,
    "retentionDays": 7,
    "dbPath": null,
    "flushInterval": 5000,
    "flushBatchSize": 20
  }
}
```

## Scope

### In Scope
- Memory buffer for kill switch (per-agent, rolling window)
- Separate payloads.db for storage
- Settings UI for enable/disable and retention
- Async batch write to avoid IO blocking
- Evidence preservation on kill switch trigger
- API to query payloads by event_id

### Out of Scope
- Payload compression
- Payload encryption
- Sensitive data masking (future consideration)
- Selective archiving (errors only, expensive only) - future enhancement
