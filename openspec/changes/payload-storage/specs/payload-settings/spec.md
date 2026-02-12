# Spec: Payload Settings

## Overview

Payload 儲存的配置選項，包含 CLI config 和 Dashboard UI。

## Config Schema

`~/.agentgazer/config.json`:

```json
{
  "payload": {
    "enabled": false,
    "retentionDays": 7,
    "dbPath": null,
    "bufferWindowSize": 50,
    "flushInterval": 5000,
    "flushBatchSize": 20
  }
}
```

## Config Type

`packages/cli/src/config.ts`:

```typescript
export interface PayloadConfig {
  /** 是否啟用 payload archive */
  enabled: boolean;
  /** Archive 保留天數 (1-365) */
  retentionDays: number;
  /** 自訂 DB 路徑 (null = 預設) */
  dbPath: string | null;
  /** Memory buffer window size per agent */
  bufferWindowSize: number;
  /** Flush interval in ms */
  flushInterval: number;
  /** Flush batch size */
  flushBatchSize: number;
}

export const DEFAULT_PAYLOAD_CONFIG: PayloadConfig = {
  enabled: false,
  retentionDays: 7,
  dbPath: null,
  bufferWindowSize: 50,
  flushInterval: 5000,
  flushBatchSize: 20,
};
```

## API for Settings

### GET /api/settings

增加 payload 區塊：

```json
{
  "server": { ... },
  "data": { ... },
  "payload": {
    "enabled": false,
    "retentionDays": 7,
    "dbPath": null,
    "dbSizeBytes": 0
  }
}
```

### PUT /api/settings

```json
{
  "payload": {
    "enabled": true,
    "retentionDays": 14
  }
}
```

## Dashboard UI

Settings 頁面新增 "Payload Storage" section：

```
┌─────────────────────────────────────────────────────────┐
│  Payload Storage                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [x] Enable request/response archiving                  │
│                                                         │
│  Retention:  [ 7 ] days                                 │
│                                                         │
│  Database size:  12.5 MB                                │
│                                                         │
│  [ Clear Archive ]  (keeps evidence)                    │
│                                                         │
│  ⚠️ Payloads may contain sensitive data.                │
│     Only enable if you need debugging/audit logs.       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Validation

- `retentionDays`: 1-365
- `bufferWindowSize`: 10-200
- `flushInterval`: 1000-60000
- `flushBatchSize`: 1-100

## Notes

- `bufferWindowSize` 影響 kill switch detection，建議 >= loop detector window
- `dbPath` 為 null 時使用 `~/.agentgazer/payloads.db`
- Evidence 不受 `enabled` 和 `retentionDays` 影響，永遠儲存
