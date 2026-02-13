# Spec: Payload Store

## Overview

管理 payloads.db 的讀寫，包含 async batch write 機制。

## Location

`packages/server/src/payload-store.ts`

## Database

獨立的 SQLite DB: `~/.agentgazer/payloads.db`

```sql
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

## Interface

```typescript
export interface PayloadStoreOptions {
  dbPath: string;
  flushInterval?: number;   // ms, 預設 5000
  flushBatchSize?: number;  // 預設 20
}

export interface PayloadRow {
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

export function initPayloadStore(options: PayloadStoreOptions): void;
export function queuePayload(payload: Omit<PayloadRow, 'id' | 'createdAt'>): void;
export function saveEvidence(killSwitchEventId: string, payloads: BufferedPayload[]): void;
export function getPayloadByEventId(eventId: string): PayloadRow | null;
export function getEvidenceByKillSwitch(killSwitchEventId: string): PayloadRow[];
export function cleanupArchive(retentionDays: number): number;
export function getDbSize(): number;
export function closePayloadStore(): void;
```

## Batch Write Mechanism

```
queuePayload()
     │
     ▼
┌─────────────┐
│ writeBuffer │──────┐
└─────────────┘      │
     │               │
     ▼               ▼
 buffer.length    flushTimer
 >= batchSize     (每 5 秒)
     │               │
     └───────┬───────┘
             │
             ▼
         flush()
             │
             ▼
    BEGIN TRANSACTION
    INSERT ... (batch)
    COMMIT
```

## Evidence 寫入

Evidence 不走 batch，直接同步寫入（因為 kill switch 是重要事件）：

```typescript
function saveEvidence(killSwitchEventId: string, payloads: BufferedPayload[]): void {
  const stmt = db.prepare(`
    INSERT INTO event_payloads
    (id, event_id, agent_id, request_body, response_body, size_bytes, purpose, pinned, kill_switch_event_id)
    VALUES (?, ?, ?, ?, ?, ?, 'evidence', 1, ?)
  `);

  db.transaction(() => {
    for (const p of payloads) {
      stmt.run(uuid(), p.eventId, p.agentId, p.requestBody, p.responseBody,
               (p.requestBody?.length ?? 0) + (p.responseBody?.length ?? 0),
               killSwitchEventId);
    }
  })();
}
```

## Cleanup

```typescript
function cleanupArchive(retentionDays: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = db.prepare(`
    DELETE FROM event_payloads
    WHERE purpose = 'archive'
      AND pinned = 0
      AND created_at < ?
  `).run(cutoff.toISOString());

  return result.changes;
}
```

## Tests

- queuePayload 不立即寫入
- flush 後 buffer 清空
- Evidence 立即寫入且 pinned=1
- cleanupArchive 不刪除 evidence
- cleanupArchive 不刪除 pinned 記錄
