/**
 * Payload Store - Manages the separate payloads.db for request/response bodies.
 *
 * Features:
 * - Separate SQLite database from main data.db
 * - Async batch write to avoid IO blocking
 * - Evidence preservation for kill switch analysis
 * - Retention-based cleanup for archive data
 */

import Database from "better-sqlite3";
import * as crypto from "node:crypto";
import { createLogger } from "@agentgazer/shared";

const log = createLogger("payload-store");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayloadRow {
  id: string;
  event_id: string;
  agent_id: string;
  request_body: string | null;
  response_body: string | null;
  size_bytes: number;
  purpose: "archive" | "evidence";
  pinned: number; // 0 or 1
  kill_switch_event_id: string | null;
  created_at: string;
}

export interface PayloadStoreOptions {
  dbPath: string;
  flushInterval?: number; // ms, default 5000
  flushBatchSize?: number; // default 20
}

export interface BufferedPayloadInput {
  eventId: string;
  agentId: string;
  requestBody: string;
  responseBody: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS event_payloads (
    id                    TEXT PRIMARY KEY,
    event_id              TEXT NOT NULL,
    agent_id              TEXT NOT NULL,
    request_body          TEXT,
    response_body         TEXT,
    size_bytes            INTEGER NOT NULL DEFAULT 0,
    purpose               TEXT NOT NULL CHECK (purpose IN ('archive', 'evidence')),
    pinned                INTEGER NOT NULL DEFAULT 0,
    kill_switch_event_id  TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_payloads_event_id ON event_payloads(event_id);
  CREATE INDEX IF NOT EXISTS idx_payloads_agent_id ON event_payloads(agent_id);
  CREATE INDEX IF NOT EXISTS idx_payloads_purpose ON event_payloads(purpose);
  CREATE INDEX IF NOT EXISTS idx_payloads_created_at ON event_payloads(created_at);
  CREATE INDEX IF NOT EXISTS idx_payloads_kill_switch ON event_payloads(kill_switch_event_id);
`;

// ---------------------------------------------------------------------------
// PayloadStore Class
// ---------------------------------------------------------------------------

export class PayloadStore {
  private db: Database.Database;
  private writeBuffer: PayloadRow[] = [];
  private flushInterval: number;
  private flushBatchSize: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(options: PayloadStoreOptions) {
    this.flushInterval = options.flushInterval ?? 5000;
    this.flushBatchSize = options.flushBatchSize ?? 20;

    // Open database
    this.db = new Database(options.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    // Initialize schema
    this.db.exec(SCHEMA);

    // Start flush timer
    this.startFlushTimer();

    log.info("Payload store initialized", { dbPath: options.dbPath });
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
    this.flushTimer.unref();
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Queue a payload for async batch write.
   */
  queue(eventId: string, agentId: string, requestBody: string | null, responseBody: string | null): void {
    if (this.closed) return;

    const payload: PayloadRow = {
      id: crypto.randomUUID(),
      event_id: eventId,
      agent_id: agentId,
      request_body: requestBody,
      response_body: responseBody,
      size_bytes: (requestBody?.length ?? 0) + (responseBody?.length ?? 0),
      purpose: "archive",
      pinned: 0,
      kill_switch_event_id: null,
      created_at: new Date().toISOString(),
    };

    this.writeBuffer.push(payload);

    // Flush if buffer is full
    if (this.writeBuffer.length >= this.flushBatchSize) {
      this.flush();
    }
  }

  /**
   * Flush the write buffer to database.
   */
  flush(): void {
    if (this.writeBuffer.length === 0 || this.closed) return;

    const payloads = this.writeBuffer.splice(0, this.writeBuffer.length);

    try {
      const stmt = this.db.prepare(`
        INSERT INTO event_payloads
        (id, event_id, agent_id, request_body, response_body, size_bytes, purpose, pinned, kill_switch_event_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((rows: PayloadRow[]) => {
        for (const row of rows) {
          stmt.run(
            row.id,
            row.event_id,
            row.agent_id,
            row.request_body,
            row.response_body,
            row.size_bytes,
            row.purpose,
            row.pinned,
            row.kill_switch_event_id,
            row.created_at
          );
        }
      });

      insertMany(payloads);
      log.debug(`Flushed ${payloads.length} payloads to database`);
    } catch (err) {
      log.error("Failed to flush payloads", { err: String(err), count: payloads.length });
      // Don't re-add to buffer - let them be lost rather than grow unbounded
    }
  }

  /**
   * Save kill switch evidence (synchronous, important data).
   */
  saveEvidence(killSwitchEventId: string, payloads: BufferedPayloadInput[]): number {
    if (this.closed || payloads.length === 0) return 0;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO event_payloads
        (id, event_id, agent_id, request_body, response_body, size_bytes, purpose, pinned, kill_switch_event_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'evidence', 1, ?, ?)
      `);

      const insertMany = this.db.transaction((items: BufferedPayloadInput[]) => {
        for (const p of items) {
          const sizeBytes = (p.requestBody?.length ?? 0) + (p.responseBody?.length ?? 0);
          stmt.run(
            crypto.randomUUID(),
            p.eventId,
            p.agentId,
            p.requestBody,
            p.responseBody,
            sizeBytes,
            killSwitchEventId,
            new Date(p.timestamp).toISOString()
          );
        }
      });

      insertMany(payloads);
      log.info(`Saved ${payloads.length} evidence payloads for kill switch ${killSwitchEventId}`);
      return payloads.length;
    } catch (err) {
      log.error("Failed to save evidence", { err: String(err), killSwitchEventId });
      return 0;
    }
  }

  /**
   * Get payload by event ID.
   */
  getByEventId(eventId: string): PayloadRow | null {
    if (this.closed) return null;
    return this.db.prepare("SELECT * FROM event_payloads WHERE event_id = ?").get(eventId) as PayloadRow | undefined ?? null;
  }

  /**
   * Get all evidence payloads for a kill switch event.
   */
  getEvidenceByKillSwitch(killSwitchEventId: string): PayloadRow[] {
    if (this.closed) return [];
    return this.db.prepare(
      "SELECT * FROM event_payloads WHERE kill_switch_event_id = ? ORDER BY created_at ASC"
    ).all(killSwitchEventId) as PayloadRow[];
  }

  /**
   * Cleanup old archive payloads (not evidence).
   */
  cleanup(retentionDays: number): number {
    if (this.closed) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const result = this.db.prepare(`
        DELETE FROM event_payloads
        WHERE purpose = 'archive'
          AND pinned = 0
          AND created_at < ?
      `).run(cutoff.toISOString());

      if (result.changes > 0) {
        log.info(`Cleaned up ${result.changes} old archive payloads`);
      }
      return result.changes;
    } catch (err) {
      log.error("Failed to cleanup payloads", { err: String(err) });
      return 0;
    }
  }

  /**
   * Delete all archive payloads (not evidence).
   */
  clearArchive(): number {
    if (this.closed) return 0;

    try {
      const result = this.db.prepare(`
        DELETE FROM event_payloads
        WHERE purpose = 'archive'
          AND pinned = 0
      `).run();

      log.info(`Cleared ${result.changes} archive payloads`);
      return result.changes;
    } catch (err) {
      log.error("Failed to clear archive", { err: String(err) });
      return 0;
    }
  }

  /**
   * Get database file size in bytes.
   */
  getDbSize(): number {
    if (this.closed) return 0;
    try {
      const row = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number } | undefined;
      return row?.size ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get payload count by purpose.
   */
  getStats(): { archive: number; evidence: number; totalSize: number } {
    if (this.closed) return { archive: 0, evidence: 0, totalSize: 0 };
    try {
      const archive = (this.db.prepare("SELECT COUNT(*) as count FROM event_payloads WHERE purpose = 'archive'").get() as { count: number }).count;
      const evidence = (this.db.prepare("SELECT COUNT(*) as count FROM event_payloads WHERE purpose = 'evidence'").get() as { count: number }).count;
      const totalSize = this.getDbSize();
      return { archive, evidence, totalSize };
    } catch {
      return { archive: 0, evidence: 0, totalSize: 0 };
    }
  }

  /**
   * Close the store (flush remaining and close DB).
   */
  close(): void {
    if (this.closed) return;
    this.stopFlushTimer();
    this.flush(); // Final flush before marking closed
    this.closed = true;
    this.db.close();
    log.info("Payload store closed");
  }
}

// ---------------------------------------------------------------------------
// Singleton instance management
// ---------------------------------------------------------------------------

let instance: PayloadStore | null = null;

export function initPayloadStore(options: PayloadStoreOptions): PayloadStore {
  if (instance) {
    instance.close();
  }
  instance = new PayloadStore(options);
  return instance;
}

export function getPayloadStore(): PayloadStore | null {
  return instance;
}

export function closePayloadStore(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
