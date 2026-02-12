import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import express from "express";
import request from "supertest";
import { createPayloadsRouter } from "../../routes/payloads.js";
import { initPayloadStore, closePayloadStore } from "../../payload-store.js";

describe("payloads routes", () => {
  let app: express.Express;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "payloads-routes-test-"));
    dbPath = path.join(tempDir, "payloads.db");

    // Initialize payload store
    initPayloadStore({ dbPath, flushBatchSize: 1, flushInterval: 60000 });

    app = express();
    app.use(express.json());
    app.use("/api/payloads", createPayloadsRouter());
  });

  afterEach(() => {
    closePayloadStore();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("POST /api/payloads", () => {
    it("queues a payload", async () => {
      const res = await request(app)
        .post("/api/payloads")
        .send({
          eventId: "event-1",
          agentId: "agent-1",
          requestBody: '{"messages": []}',
          responseBody: '{"content": "response"}',
        });

      expect(res.status).toBe(201);
      expect(res.body.queued).toBe(true);
    });

    it("returns 400 for missing eventId", async () => {
      const res = await request(app)
        .post("/api/payloads")
        .send({
          agentId: "agent-1",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("eventId");
    });

    it("returns 400 for missing agentId", async () => {
      const res = await request(app)
        .post("/api/payloads")
        .send({
          eventId: "event-1",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("agentId");
    });

    it("accepts null request/response bodies", async () => {
      const res = await request(app)
        .post("/api/payloads")
        .send({
          eventId: "event-1",
          agentId: "agent-1",
        });

      expect(res.status).toBe(201);
    });
  });

  describe("POST /api/payloads/evidence", () => {
    it("saves evidence payloads", async () => {
      const res = await request(app)
        .post("/api/payloads/evidence")
        .send({
          killSwitchEventId: "ks-1",
          payloads: [
            {
              eventId: "e1",
              agentId: "a1",
              requestBody: "req",
              responseBody: "res",
              timestamp: Date.now(),
            },
            {
              eventId: "e2",
              agentId: "a1",
              requestBody: "req2",
              responseBody: "res2",
              timestamp: Date.now(),
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.saved).toBe(2);
    });

    it("returns 400 for missing killSwitchEventId", async () => {
      const res = await request(app)
        .post("/api/payloads/evidence")
        .send({
          payloads: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("killSwitchEventId");
    });

    it("returns 400 for missing payloads array", async () => {
      const res = await request(app)
        .post("/api/payloads/evidence")
        .send({
          killSwitchEventId: "ks-1",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("payloads");
    });
  });

  describe("GET /api/payloads/:eventId", () => {
    it("returns payload by event ID", async () => {
      // Queue and flush a payload
      await request(app)
        .post("/api/payloads")
        .send({
          eventId: "event-1",
          agentId: "agent-1",
          requestBody: '{"messages": []}',
          responseBody: '{"content": "response"}',
        });

      const res = await request(app).get("/api/payloads/event-1");

      expect(res.status).toBe(200);
      expect(res.body.event_id).toBe("event-1");
      expect(res.body.agent_id).toBe("agent-1");
      expect(res.body.request_body).toBe('{"messages": []}');
      expect(res.body.response_body).toBe('{"content": "response"}');
    });

    it("returns 404 for unknown event", async () => {
      const res = await request(app).get("/api/payloads/unknown");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Payload not found");
    });
  });

  describe("GET /api/payloads/evidence/:killSwitchEventId", () => {
    it("returns evidence payloads", async () => {
      // Save evidence
      await request(app)
        .post("/api/payloads/evidence")
        .send({
          killSwitchEventId: "ks-1",
          payloads: [
            { eventId: "e1", agentId: "a1", requestBody: "r1", responseBody: "s1", timestamp: Date.now() },
            { eventId: "e2", agentId: "a1", requestBody: "r2", responseBody: "s2", timestamp: Date.now() },
          ],
        });

      const res = await request(app).get("/api/payloads/evidence/ks-1");

      expect(res.status).toBe(200);
      expect(res.body.killSwitchEventId).toBe("ks-1");
      expect(res.body.count).toBe(2);
      expect(res.body.payloads).toHaveLength(2);
    });

    it("returns empty array for unknown kill switch", async () => {
      const res = await request(app).get("/api/payloads/evidence/unknown");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.payloads).toEqual([]);
    });
  });

  describe("DELETE /api/payloads/archive", () => {
    it("clears archive payloads", async () => {
      // Queue some payloads
      await request(app)
        .post("/api/payloads")
        .send({ eventId: "e1", agentId: "a1", requestBody: "r1", responseBody: "s1" });
      await request(app)
        .post("/api/payloads")
        .send({ eventId: "e2", agentId: "a1", requestBody: "r2", responseBody: "s2" });

      const res = await request(app).delete("/api/payloads/archive");

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(2);

      // Verify deleted
      const get1 = await request(app).get("/api/payloads/e1");
      expect(get1.status).toBe(404);
    });

    it("does not clear evidence", async () => {
      // Save evidence
      await request(app)
        .post("/api/payloads/evidence")
        .send({
          killSwitchEventId: "ks-1",
          payloads: [
            { eventId: "e1", agentId: "a1", requestBody: "r", responseBody: "s", timestamp: Date.now() },
          ],
        });

      // Clear archive
      await request(app).delete("/api/payloads/archive");

      // Evidence should still exist
      const res = await request(app).get("/api/payloads/evidence/ks-1");
      expect(res.body.count).toBe(1);
    });
  });

  describe("GET /api/payloads/stats", () => {
    it("returns stats", async () => {
      // Add some payloads
      await request(app)
        .post("/api/payloads")
        .send({ eventId: "e1", agentId: "a1", requestBody: "r", responseBody: "s" });

      await request(app)
        .post("/api/payloads/evidence")
        .send({
          killSwitchEventId: "ks-1",
          payloads: [
            { eventId: "e2", agentId: "a1", requestBody: "r", responseBody: "s", timestamp: Date.now() },
          ],
        });

      const res = await request(app).get("/api/payloads/stats");

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.archive).toBe(1);
      expect(res.body.evidence).toBe(1);
      expect(res.body.totalSize).toBeGreaterThan(0);
    });
  });
});

describe("payloads routes without store", () => {
  let app: express.Express;

  beforeEach(() => {
    closePayloadStore();
    app = express();
    app.use(express.json());
    app.use("/api/payloads", createPayloadsRouter());
  });

  it("POST /api/payloads returns 503 when store not enabled", async () => {
    const res = await request(app)
      .post("/api/payloads")
      .send({ eventId: "e1", agentId: "a1" });

    expect(res.status).toBe(503);
    expect(res.body.error).toContain("not enabled");
  });

  it("POST /api/payloads/evidence returns 503 when store not enabled", async () => {
    const res = await request(app)
      .post("/api/payloads/evidence")
      .send({ killSwitchEventId: "ks-1", payloads: [] });

    expect(res.status).toBe(503);
  });

  it("GET /api/payloads/:eventId returns 503 when store not enabled", async () => {
    const res = await request(app).get("/api/payloads/event-1");
    expect(res.status).toBe(503);
  });

  it("GET /api/payloads/evidence/:id returns 503 when store not enabled", async () => {
    const res = await request(app).get("/api/payloads/evidence/ks-1");
    expect(res.status).toBe(503);
  });

  it("DELETE /api/payloads/archive returns 503 when store not enabled", async () => {
    const res = await request(app).delete("/api/payloads/archive");
    expect(res.status).toBe(503);
  });

  it("GET /api/payloads/stats returns enabled: false when store not enabled", async () => {
    const res = await request(app).get("/api/payloads/stats");

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.archive).toBe(0);
    expect(res.body.evidence).toBe(0);
  });
});
