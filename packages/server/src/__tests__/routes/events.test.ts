import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { initDatabase, insertEvents } from "../../db.js";
import eventsRouter from "../../routes/events.js";

describe("events routes", () => {
  let app: express.Express;
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  /** Helper to create a valid event object */
  function makeEvent(overrides: Partial<{
    agent_id: string;
    event_type: string;
    source: string;
    timestamp: string;
    provider: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    latency_ms: number;
  }> = {}) {
    return {
      agent_id: "test-agent",
      event_type: "llm_call",
      source: "sdk",
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  /** Helper to create an agent directly in the database */
  function createAgent(agentId: string): void {
    const stmt = db.prepare(`
      INSERT INTO agents (id, agent_id, name, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(randomUUID(), agentId, agentId);
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "events-routes-test-"));
    dbPath = path.join(tempDir, "test.db");

    db = initDatabase({ path: dbPath });

    app = express();
    app.use(express.json());
    app.locals.db = db;
    app.use(eventsRouter);
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("POST /api/events", () => {
    it("ingests a single event", async () => {
      const res = await request(app)
        .post("/api/events")
        .send(makeEvent());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.event_ids).toHaveLength(1);
    });

    it("ingests multiple events", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({
          events: [
            makeEvent({ agent_id: "agent-1" }),
            makeEvent({ agent_id: "agent-2" }),
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.event_ids).toHaveLength(2);
    });

    it("returns 400 for missing agent_id", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({
          event_type: "llm_call",
          source: "sdk",
          timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.results[0].error).toContain("agent_id");
    });

    it("returns 400 for invalid event_type", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({
          agent_id: "test-agent",
          event_type: "invalid_type",
          source: "sdk",
          timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.results[0].error).toContain("event_type");
    });

    it("returns 400 for invalid source", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({
          agent_id: "test-agent",
          event_type: "llm_call",
          source: "invalid_source",
          timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.results[0].error).toContain("source");
    });

    it("returns 400 for missing timestamp", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({
          agent_id: "test-agent",
          event_type: "llm_call",
          source: "sdk",
        });

      expect(res.status).toBe(400);
      expect(res.body.results[0].error).toContain("timestamp");
    });

    it("returns 207 for partial success", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({
          events: [
            makeEvent(), // valid
            { agent_id: "test", event_type: "invalid" }, // invalid
          ],
        });

      expect(res.status).toBe(207);
      expect(res.body.event_ids).toHaveLength(1);
      expect(res.body.results.some((r: { success: boolean }) => r.success)).toBe(true);
      expect(res.body.results.some((r: { success: boolean }) => !r.success)).toBe(true);
    });

    it("accepts all valid event types", async () => {
      const validTypes = ["llm_call", "completion", "heartbeat", "error", "custom", "blocked", "kill_switch"];

      for (const eventType of validTypes) {
        const res = await request(app)
          .post("/api/events")
          .send(makeEvent({ event_type: eventType }));

        expect(res.status).toBe(200);
      }
    });

    it("accepts optional fields", async () => {
      const res = await request(app)
        .post("/api/events")
        .send(makeEvent({
          provider: "openai",
          model: "gpt-4",
          tokens_in: 100,
          tokens_out: 50,
          cost_usd: 0.005,
          latency_ms: 1200,
        }));

      expect(res.status).toBe(200);
    });

    it("creates agents automatically", async () => {
      await request(app)
        .post("/api/events")
        .send(makeEvent({ agent_id: "new-agent" }));

      // Verify agent was created
      const agent = db.prepare("SELECT * FROM agents WHERE agent_id = ?").get("new-agent");
      expect(agent).toBeDefined();
    });
  });

  describe("GET /api/events", () => {
    beforeEach(() => {
      createAgent("my-agent");
      // Insert some test events
      insertEvents(db, [
        { agent_id: "my-agent", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString(), provider: "openai", model: "gpt-4" },
        { agent_id: "my-agent", event_type: "error", source: "sdk", timestamp: new Date().toISOString() },
        { agent_id: "my-agent", event_type: "heartbeat", source: "sdk", timestamp: new Date().toISOString() },
      ]);
    });

    it("returns all events for an agent", async () => {
      const res = await request(app).get("/api/events?agent_id=my-agent");

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(3);
    });

    it("filters by event_type", async () => {
      const res = await request(app).get("/api/events?agent_id=my-agent&event_type=llm_call");

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].event_type).toBe("llm_call");
    });

    it("filters by provider", async () => {
      const res = await request(app).get("/api/events?agent_id=my-agent&provider=openai");

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
    });

    it("filters by model", async () => {
      const res = await request(app).get("/api/events?agent_id=my-agent&model=gpt-4");

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
    });

    it("supports pagination with limit and offset", async () => {
      const res = await request(app).get("/api/events?agent_id=my-agent&limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
    });

    it("returns events globally without agent_id", async () => {
      createAgent("other-agent");
      insertEvents(db, [
        { agent_id: "other-agent", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() },
      ]);

      const res = await request(app).get("/api/events?limit=10");

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("GET /api/events/recent", () => {
    beforeEach(() => {
      createAgent("my-agent");
      // Insert some test events
      for (let i = 0; i < 15; i++) {
        insertEvents(db, [
          { agent_id: "my-agent", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() },
        ]);
      }
    });

    it("returns recent events with default limit", async () => {
      const res = await request(app).get("/api/events/recent?agent_id=my-agent");

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeLessThanOrEqual(100);
    });

    it("respects custom limit", async () => {
      const res = await request(app).get("/api/events/recent?agent_id=my-agent&limit=5");

      expect(res.status).toBe(200);
      // May return less if there's event grouping or filtering
      expect(res.body.events.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /api/events/:id", () => {
    it("returns event by ID", async () => {
      const ids = insertEvents(db, [
        { agent_id: "my-agent", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() },
      ]);

      const res = await request(app).get(`/api/events/${ids[0]}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ids[0]);
    });

    it("returns 404 for non-existent event", async () => {
      const res = await request(app).get(`/api/events/${randomUUID()}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });
  });
});
