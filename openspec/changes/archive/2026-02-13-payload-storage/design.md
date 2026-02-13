# Design: Payload Storage

## Overview

實現三層 payload 儲存架構：Memory Buffer → Archive → Evidence

## Components

### 1. PayloadBuffer (packages/proxy)

記憶體中的 rolling buffer，per-agent。

```typescript
// packages/proxy/src/payload-buffer.ts

interface BufferedPayload {
  eventId: string;
  agentId: string;
  requestBody: string;
  responseBody: string;
  timestamp: number;
}

class PayloadBuffer {
  private buffers: Map<string, BufferedPayload[]> = new Map();
  private windowSize: number = 50;

  // 加入新 payload，超過 window 自動滾動
  push(agentId: string, payload: BufferedPayload): void;

  // 取得某 agent 的所有 buffer（給 kill switch 用）
  get(agentId: string): BufferedPayload[];

  // Kill switch 觸發時，取出並清空
  extract(agentId: string): BufferedPayload[];
}
```

### 2. PayloadStore (packages/server)

管理 payloads.db 的讀寫。

```typescript
// packages/server/src/payload-store.ts

interface PayloadRow {
  id: string;
  eventId: string;
  agentId: string;
  requestBody: string | null;
  responseBody: string | null;
  sizeBytes: number;
  purpose: 'archive' | 'evidence';
  pinned: boolean;
  killSwitchEventId: string | null;
  createdAt: string;
}

class PayloadStore {
  private db: Database;
  private writeBuffer: PayloadRow[] = [];
  private flushTimer: NodeJS.Timeout;

  constructor(dbPath: string, options: PayloadStoreOptions);

  // 非同步加入 write buffer
  queue(payload: PayloadRow): void;

  // Batch flush to DB
  private flush(): Promise<void>;

  // 查詢 payload by event_id
  getByEventId(eventId: string): PayloadRow | null;

  // 儲存 kill switch evidence
  saveEvidence(killSwitchEventId: string, payloads: BufferedPayload[]): void;

  // Retention 清理
  cleanup(retentionDays: number): number;
}
```

### 3. Database Schema

```sql
-- payloads.db

CREATE TABLE event_payloads (
  id                  TEXT PRIMARY KEY,
  event_id            TEXT NOT NULL,
  agent_id            TEXT NOT NULL,
  request_body        TEXT,
  response_body       TEXT,
  size_bytes          INTEGER NOT NULL DEFAULT 0,
  purpose             TEXT NOT NULL CHECK (purpose IN ('archive', 'evidence')),
  pinned              INTEGER NOT NULL DEFAULT 0,
  kill_switch_event_id TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payloads_event_id ON event_payloads(event_id);
CREATE INDEX idx_payloads_agent_id ON event_payloads(agent_id);
CREATE INDEX idx_payloads_purpose ON event_payloads(purpose);
CREATE INDEX idx_payloads_created_at ON event_payloads(created_at);
CREATE INDEX idx_payloads_kill_switch ON event_payloads(kill_switch_event_id);
```

### 4. Config Schema

```typescript
// packages/cli/src/config.ts

interface PayloadConfig {
  enabled: boolean;           // 是否啟用 archive
  retentionDays: number;      // archive 保留天數
  dbPath?: string;            // 自訂 DB 路徑
  bufferWindowSize: number;   // memory buffer 大小 (預設 50)
  flushInterval: number;      // flush 間隔 ms (預設 5000)
  flushBatchSize: number;     // batch 大小 (預設 20)
}
```

## Data Flow

### Normal Request (Archive Enabled)

```
Request
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Proxy                                                   │
│                                                         │
│  1. 處理 request/response                               │
│  2. PayloadBuffer.push(agentId, payload)                │
│  3. 如果 archive enabled:                               │
│     POST /api/payloads { eventId, request, response }   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Server                                                  │
│                                                         │
│  1. PayloadStore.queue(payload)  // 加入 buffer        │
│  2. 當 buffer 滿或 timer 到:                            │
│     - Batch INSERT into payloads.db                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Kill Switch Trigger

```
Loop Detected!
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Proxy                                                   │
│                                                         │
│  1. payloads = PayloadBuffer.extract(agentId)           │
│  2. POST /api/events { type: 'kill_switch', ... }       │
│  3. POST /api/payloads/evidence {                       │
│       killSwitchEventId,                                │
│       payloads: [...]                                   │
│     }                                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Server                                                  │
│                                                         │
│  1. PayloadStore.saveEvidence(                          │
│       killSwitchEventId,                                │
│       payloads                                          │
│     )                                                   │
│  2. INSERT with purpose='evidence', pinned=1            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/payloads | Archive a payload |
| POST | /api/payloads/evidence | Save kill switch evidence |
| GET | /api/payloads/:eventId | Get payload by event ID |
| GET | /api/kill-switch/:eventId/evidence | Get all evidence for a kill switch |

## Settings UI

Dashboard Settings 新增 "Payload Storage" 區塊：

- Toggle: Enable payload archiving
- Input: Retention days (7-365)
- Display: Current payloads.db size
- Button: Clear archived payloads (保留 evidence)

## Cleanup Job

Server 啟動時 + 每日執行：

```typescript
function cleanupPayloads() {
  const config = getPayloadConfig();
  if (!config.enabled) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.retentionDays);

  // 只清理 archive，不清理 evidence (pinned=1)
  db.exec(`
    DELETE FROM event_payloads
    WHERE purpose = 'archive'
      AND pinned = 0
      AND created_at < ?
  `, cutoff.toISOString());
}
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Payloads.db 過大 | 獨立 DB + retention 清理 |
| IO 阻塞 | Async batch write |
| 記憶體過多 | Fixed window size per agent |
| 重啟丟失 buffer | 可接受，evidence 會存 DB |
