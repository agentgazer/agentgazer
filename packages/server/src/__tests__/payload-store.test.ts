import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  PayloadStore,
  initPayloadStore,
  getPayloadStore,
  closePayloadStore,
  type BufferedPayloadInput,
} from "../payload-store.js";

describe("PayloadStore", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "payload-store-test-"));
    dbPath = path.join(tempDir, "payloads.db");
  });

  afterEach(() => {
    closePayloadStore();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("initialization", () => {
    it("creates database with schema", () => {
      const store = new PayloadStore({ dbPath });
      expect(fs.existsSync(dbPath)).toBe(true);
      store.close();
    });

    it("initializes singleton correctly", () => {
      initPayloadStore({ dbPath });
      const store = getPayloadStore();
      expect(store).not.toBeNull();
    });
  });

  describe("queue and flush", () => {
    it("queues and flushes payloads", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      store.queue("event-1", "agent-1", '{"request": 1}', '{"response": 1}');
      store.queue("event-2", "agent-1", '{"request": 2}', '{"response": 2}');

      // Manually flush
      store.flush();

      // Verify stored
      const payload1 = store.getByEventId("event-1");
      expect(payload1).not.toBeNull();
      expect(payload1!.agent_id).toBe("agent-1");
      expect(payload1!.request_body).toBe('{"request": 1}');
      expect(payload1!.purpose).toBe("archive");
      expect(payload1!.pinned).toBe(0);
    });

    it("auto-flushes when batch size reached", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 2, flushInterval: 60000 });

      store.queue("event-1", "agent-1", "req1", "res1");
      store.queue("event-2", "agent-1", "req2", "res2"); // Should trigger flush

      // Should be stored after auto-flush
      const payload = store.getByEventId("event-1");
      expect(payload).not.toBeNull();
    });

    it("handles null request/response bodies", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      store.queue("event-1", "agent-1", null, null);
      store.flush();

      const payload = store.getByEventId("event-1");
      expect(payload).not.toBeNull();
      expect(payload!.request_body).toBeNull();
      expect(payload!.response_body).toBeNull();
      expect(payload!.size_bytes).toBe(0);
    });

    it("calculates size_bytes correctly", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      const req = '{"test": "request"}';
      const res = '{"test": "response"}';
      store.queue("event-1", "agent-1", req, res);
      store.flush();

      const payload = store.getByEventId("event-1");
      expect(payload!.size_bytes).toBe(req.length + res.length);
    });
  });

  describe("evidence storage", () => {
    it("saves evidence synchronously", () => {
      const store = initPayloadStore({ dbPath });

      const payloads: BufferedPayloadInput[] = [
        {
          eventId: "event-1",
          agentId: "agent-1",
          requestBody: '{"messages": []}',
          responseBody: '{"content": "response"}',
          timestamp: Date.now(),
        },
        {
          eventId: "event-2",
          agentId: "agent-1",
          requestBody: '{"messages": []}',
          responseBody: '{"content": "response 2"}',
          timestamp: Date.now(),
        },
      ];

      const saved = store.saveEvidence("kill-switch-1", payloads);
      expect(saved).toBe(2);

      // Verify stored as evidence
      const payload1 = store.getByEventId("event-1");
      expect(payload1).not.toBeNull();
      expect(payload1!.purpose).toBe("evidence");
      expect(payload1!.pinned).toBe(1);
      expect(payload1!.kill_switch_event_id).toBe("kill-switch-1");
    });

    it("retrieves evidence by kill switch event ID", () => {
      const store = initPayloadStore({ dbPath });

      const payloads: BufferedPayloadInput[] = [
        { eventId: "e1", agentId: "a1", requestBody: "r1", responseBody: "s1", timestamp: Date.now() },
        { eventId: "e2", agentId: "a1", requestBody: "r2", responseBody: "s2", timestamp: Date.now() + 1 },
      ];

      store.saveEvidence("ks-1", payloads);

      const evidence = store.getEvidenceByKillSwitch("ks-1");
      expect(evidence).toHaveLength(2);
      expect(evidence[0].event_id).toBe("e1");
      expect(evidence[1].event_id).toBe("e2");
    });

    it("returns empty array for unknown kill switch", () => {
      const store = initPayloadStore({ dbPath });
      const evidence = store.getEvidenceByKillSwitch("unknown");
      expect(evidence).toEqual([]);
    });
  });

  describe("cleanup", () => {
    it("cleans up old archive payloads", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      store.queue("event-1", "agent-1", "req", "res");
      store.flush();

      // Cleanup with -1 retention (negative days) should delete all existing rows
      // since any row will be older than "tomorrow"
      const deleted = store.cleanup(-1);
      expect(deleted).toBe(1);

      // Verify deleted
      const payload = store.getByEventId("event-1");
      expect(payload).toBeNull();
    });

    it("does not clean up evidence", () => {
      const store = initPayloadStore({ dbPath });

      store.saveEvidence("ks-1", [
        { eventId: "e1", agentId: "a1", requestBody: "r", responseBody: "s", timestamp: Date.now() },
      ]);

      // Try to cleanup with 0 retention
      const deleted = store.cleanup(0);
      expect(deleted).toBe(0);

      // Evidence should still exist
      const evidence = store.getEvidenceByKillSwitch("ks-1");
      expect(evidence).toHaveLength(1);
    });

    it("does not clean up pinned payloads", () => {
      const store = initPayloadStore({ dbPath });

      // Evidence is always pinned
      store.saveEvidence("ks-1", [
        { eventId: "e1", agentId: "a1", requestBody: "r", responseBody: "s", timestamp: Date.now() },
      ]);

      const deleted = store.cleanup(0);
      expect(deleted).toBe(0);
    });
  });

  describe("clearArchive", () => {
    it("clears all archive payloads", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      store.queue("event-1", "agent-1", "req1", "res1");
      store.queue("event-2", "agent-1", "req2", "res2");
      store.flush();

      const deleted = store.clearArchive();
      expect(deleted).toBe(2);

      expect(store.getByEventId("event-1")).toBeNull();
      expect(store.getByEventId("event-2")).toBeNull();
    });

    it("does not clear evidence", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      // Add archive
      store.queue("event-1", "agent-1", "req", "res");
      store.flush();

      // Add evidence
      store.saveEvidence("ks-1", [
        { eventId: "e2", agentId: "a1", requestBody: "r", responseBody: "s", timestamp: Date.now() },
      ]);

      const deleted = store.clearArchive();
      expect(deleted).toBe(1);

      // Evidence still exists
      const evidence = store.getEvidenceByKillSwitch("ks-1");
      expect(evidence).toHaveLength(1);
    });
  });

  describe("stats", () => {
    it("returns correct counts", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });

      // Add archive payloads
      store.queue("e1", "a1", "r1", "s1");
      store.queue("e2", "a1", "r2", "s2");
      store.flush();

      // Add evidence
      store.saveEvidence("ks-1", [
        { eventId: "e3", agentId: "a1", requestBody: "r", responseBody: "s", timestamp: Date.now() },
      ]);

      const stats = store.getStats();
      expect(stats.archive).toBe(2);
      expect(stats.evidence).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it("returns zeros for empty store", () => {
      const store = initPayloadStore({ dbPath });
      const stats = store.getStats();
      expect(stats.archive).toBe(0);
      expect(stats.evidence).toBe(0);
    });
  });

  describe("getByEventId", () => {
    it("returns null for unknown event", () => {
      const store = initPayloadStore({ dbPath });
      expect(store.getByEventId("unknown")).toBeNull();
    });
  });

  describe("close", () => {
    it("flushes remaining payloads on close", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 100, flushInterval: 60000 });

      store.queue("event-1", "agent-1", "req", "res");
      // Don't manually flush

      store.close();

      // Reopen to verify
      const store2 = new PayloadStore({ dbPath });
      const payload = store2.getByEventId("event-1");
      expect(payload).not.toBeNull();
      store2.close();
    });

    it("ignores operations after close", () => {
      const store = initPayloadStore({ dbPath, flushBatchSize: 10 });
      store.close();

      // These should not throw
      store.queue("event-1", "agent-1", "req", "res");
      store.flush();
      expect(store.getByEventId("event-1")).toBeNull();
      expect(store.getStats()).toEqual({ archive: 0, evidence: 0, totalSize: 0 });
    });
  });

  describe("singleton management", () => {
    it("closes previous instance when reinitializing", () => {
      initPayloadStore({ dbPath });
      const store1 = getPayloadStore();
      store1!.queue("event-1", "agent-1", "req", "res");

      // Reinitialize with same path
      initPayloadStore({ dbPath });
      const store2 = getPayloadStore();

      // store1's unflushed data should have been flushed on close
      const payload = store2!.getByEventId("event-1");
      expect(payload).not.toBeNull();
    });

    it("returns null after closePayloadStore", () => {
      initPayloadStore({ dbPath });
      expect(getPayloadStore()).not.toBeNull();

      closePayloadStore();
      expect(getPayloadStore()).toBeNull();
    });
  });
});
