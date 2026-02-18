import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { initDatabase, insertEvents, getDailySpend, upsertAgent } from "../db.js";

describe("db: agent_events CHECK constraint", () => {
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-test-"));
    dbPath = path.join(tempDir, "test.db");
    db = initDatabase({ path: dbPath });

    // Create a test agent
    upsertAgent(db, "test-agent");
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("accepts security_blocked event type", () => {
    const ids = insertEvents(db, [
      {
        agent_id: "test-agent",
        event_type: "security_blocked",
        source: "proxy",
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(ids).toHaveLength(1);

    // Verify it's in the database
    const row = db.prepare("SELECT event_type FROM agent_events WHERE id = ?").get(ids[0]) as { event_type: string };
    expect(row.event_type).toBe("security_blocked");
  });

  it("accepts security_event event type", () => {
    const ids = insertEvents(db, [
      {
        agent_id: "test-agent",
        event_type: "security_event",
        source: "proxy",
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(ids).toHaveLength(1);

    const row = db.prepare("SELECT event_type FROM agent_events WHERE id = ?").get(ids[0]) as { event_type: string };
    expect(row.event_type).toBe("security_event");
  });

  it("rejects invalid event type", () => {
    expect(() => {
      insertEvents(db, [
        {
          agent_id: "test-agent",
          event_type: "invalid_type",
          source: "proxy",
          timestamp: new Date().toISOString(),
        },
      ]);
    }).toThrow();
  });
});

describe("db: getDailySpend uses UTC", () => {
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-daily-spend-test-"));
    dbPath = path.join(tempDir, "test.db");
    db = initDatabase({ path: dbPath });

    upsertAgent(db, "test-agent");
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("returns correct daily spend for events from today (UTC)", () => {
    // Insert an event with a cost and today's timestamp
    const now = new Date();
    insertEvents(db, [
      {
        agent_id: "test-agent",
        event_type: "llm_call",
        source: "proxy",
        timestamp: now.toISOString(),
        cost_usd: 1.5,
      },
    ]);

    const spend = getDailySpend(db, "test-agent");
    expect(spend).toBeCloseTo(1.5, 5);
  });

  it("excludes events from yesterday (UTC)", () => {
    // Insert an event with yesterday's timestamp
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(12, 0, 0, 0); // Yesterday noon UTC

    insertEvents(db, [
      {
        agent_id: "test-agent",
        event_type: "llm_call",
        source: "proxy",
        timestamp: yesterday.toISOString(),
        cost_usd: 5.0,
      },
    ]);

    const spend = getDailySpend(db, "test-agent");
    expect(spend).toBe(0);
  });

  it("sums multiple events from today correctly", () => {
    const now = new Date();

    insertEvents(db, [
      {
        agent_id: "test-agent",
        event_type: "llm_call",
        source: "proxy",
        timestamp: now.toISOString(),
        cost_usd: 2.0,
      },
      {
        agent_id: "test-agent",
        event_type: "llm_call",
        source: "proxy",
        timestamp: now.toISOString(),
        cost_usd: 3.0,
      },
    ]);

    const spend = getDailySpend(db, "test-agent");
    expect(spend).toBeCloseTo(5.0, 5);
  });
});
