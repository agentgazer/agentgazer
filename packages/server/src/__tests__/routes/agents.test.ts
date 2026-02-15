import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { initDatabase, updateAgentPolicy } from "../../db.js";
import agentsRouter from "../../routes/agents.js";

// Mock fetch globally
const originalFetch = global.fetch;

describe("agents routes", () => {
  let app: express.Express;
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  /** Helper to create an agent directly in the database */
  function createAgent(agentId: string, name?: string): void {
    const stmt = db.prepare(`
      INSERT INTO agents (id, agent_id, name, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(randomUUID(), agentId, name ?? agentId);
  }

  beforeEach(() => {
    // Mock fetch for clearLoopDetectorWindow
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-routes-test-"));
    dbPath = path.join(tempDir, "test.db");

    db = initDatabase({ path: dbPath });

    app = express();
    app.use(express.json());
    app.locals.db = db;
    app.use(agentsRouter);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("GET /api/agents", () => {
    it("returns empty list when no agents exist", async () => {
      const res = await request(app).get("/api/agents");

      expect(res.status).toBe(200);
      expect(res.body.agents).toEqual([]);
    });

    it("returns all agents without pagination params", async () => {
      createAgent("agent-1", "Agent One");
      createAgent("agent-2", "Agent Two");

      const res = await request(app).get("/api/agents");

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(2);
      expect(res.body.agents[0]).toHaveProperty("agent_id");
      expect(res.body.agents[0]).toHaveProperty("providers");
    });

    it("returns paginated results with limit and offset", async () => {
      for (let i = 1; i <= 5; i++) {
        createAgent(`agent-${i}`, `Agent ${i}`);
      }

      const res = await request(app).get("/api/agents?limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it("respects offset for pagination", async () => {
      for (let i = 1; i <= 5; i++) {
        createAgent(`agent-${i}`, `Agent ${i}`);
      }

      const res = await request(app).get("/api/agents?limit=2&offset=3");

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it("filters agents by search term", async () => {
      createAgent("alpha-agent", "Alpha Agent");
      createAgent("beta-agent", "Beta Agent");
      createAgent("gamma-agent", "Gamma Agent");

      const res = await request(app).get("/api/agents?search=alpha");

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].agent_id).toBe("alpha-agent");
    });

    it("search is case-insensitive", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app).get("/api/agents?search=MY");

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
    });

    it("enforces max limit of 100", async () => {
      for (let i = 1; i <= 5; i++) {
        createAgent(`agent-${i}`, `Agent ${i}`);
      }

      const res = await request(app).get("/api/agents?limit=200");

      expect(res.status).toBe(200);
      // Should be capped at 100 (or 5 if fewer agents exist)
      expect(res.body.agents.length).toBeLessThanOrEqual(100);
    });

    it("handles invalid limit gracefully", async () => {
      createAgent("agent-1", "Agent One");

      const res = await request(app).get("/api/agents?limit=invalid");

      expect(res.status).toBe(200);
      // Should default to 20
    });
  });

  describe("GET /api/agents/:agentId", () => {
    it("returns agent by ID", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app).get("/api/agents/my-agent");

      expect(res.status).toBe(200);
      expect(res.body.agent_id).toBe("my-agent");
      expect(res.body.name).toBe("My Agent");
    });

    it("returns 404 for non-existent agent", async () => {
      const res = await request(app).get("/api/agents/non-existent");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Agent not found");
    });

    it("handles special characters in agent ID", async () => {
      createAgent("agent-with-dashes", "Agent With Dashes");

      const res = await request(app).get("/api/agents/agent-with-dashes");

      expect(res.status).toBe(200);
      expect(res.body.agent_id).toBe("agent-with-dashes");
    });
  });

  describe("GET /api/agents/:agentId/policy", () => {
    it("returns agent policy", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app).get("/api/agents/my-agent/policy");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("active");
      expect(res.body).toHaveProperty("daily_spend");
    });

    it("returns 404 for non-existent agent", async () => {
      const res = await request(app).get("/api/agents/non-existent/policy");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Agent not found");
    });

    it("includes budget_limit in policy", async () => {
      createAgent("my-agent", "My Agent");
      updateAgentPolicy(db, "my-agent", { budget_limit: 100 });

      const res = await request(app).get("/api/agents/my-agent/policy");

      expect(res.status).toBe(200);
      expect(res.body.budget_limit).toBe(100);
    });
  });

  describe("PUT /api/agents/:agentId/policy", () => {
    it("updates agent active status", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.active).toBeFalsy(); // Boolean from API
    });

    it("updates budget_limit", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ budget_limit: 500 });

      expect(res.status).toBe(200);
      expect(res.body.budget_limit).toBe(500);
    });

    it("sets deactivated_by to manual when deactivating", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.deactivated_by).toBe("manual");
    });

    it("clears deactivated_by when activating", async () => {
      createAgent("my-agent", "My Agent");
      updateAgentPolicy(db, "my-agent", { active: false, deactivated_by: "kill_switch" });

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ active: true });

      expect(res.status).toBe(200);
      expect(res.body.deactivated_by).toBeNull();
    });

    it("returns 404 for non-existent agent", async () => {
      const res = await request(app)
        .put("/api/agents/non-existent/policy")
        .send({ active: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Agent not found");
    });

    it("validates allowed_hours_start range (0-23)", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ allowed_hours_start: 25 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("allowed_hours_start");
    });

    it("validates allowed_hours_end range (0-23)", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ allowed_hours_end: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("allowed_hours_end");
    });

    it("accepts valid allowed_hours range", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ allowed_hours_start: 9, allowed_hours_end: 17 });

      expect(res.status).toBe(200);
      expect(res.body.allowed_hours_start).toBe(9);
      expect(res.body.allowed_hours_end).toBe(17);
    });

    it("allows null budget_limit to remove limit", async () => {
      createAgent("my-agent", "My Agent");
      updateAgentPolicy(db, "my-agent", { budget_limit: 100 });

      const res = await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ budget_limit: null });

      expect(res.status).toBe(200);
      expect(res.body.budget_limit).toBeNull();
    });

    it("calls clearLoopDetectorWindow when activating agent", async () => {
      createAgent("my-agent", "My Agent");
      updateAgentPolicy(db, "my-agent", { active: false });

      await request(app)
        .put("/api/agents/my-agent/policy")
        .send({ active: true });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("GET /api/agents/:agentId/kill-switch", () => {
    it("returns kill switch config", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app).get("/api/agents/my-agent/kill-switch");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("enabled");
      expect(res.body).toHaveProperty("window_size");
      expect(res.body).toHaveProperty("threshold");
    });

    it("returns 404 for non-existent agent", async () => {
      const res = await request(app).get("/api/agents/non-existent/kill-switch");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Agent not found");
    });

    it("returns default values for new agent", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app).get("/api/agents/my-agent/kill-switch");

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBeFalsy();
      expect(res.body.window_size).toBe(20);
      expect(res.body.threshold).toBe(10);
    });
  });

  describe("PATCH /api/agents/:agentId/kill-switch", () => {
    it("enables kill switch", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBeTruthy();
    });

    it("updates window_size", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ window_size: 30 });

      expect(res.status).toBe(200);
      expect(res.body.window_size).toBe(30);
    });

    it("updates threshold", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ threshold: 15 });

      expect(res.status).toBe(200);
      expect(res.body.threshold).toBe(15);
    });

    it("returns 404 for non-existent agent", async () => {
      const res = await request(app)
        .patch("/api/agents/non-existent/kill-switch")
        .send({ enabled: true });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Agent not found");
    });

    it("validates window_size minimum (5)", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ window_size: 3 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("window_size");
    });

    it("validates window_size maximum (100)", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ window_size: 150 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("window_size");
    });

    it("validates threshold minimum (1)", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ threshold: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("threshold");
    });

    it("validates threshold maximum (50)", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ threshold: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("threshold");
    });

    it("updates multiple fields at once", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app)
        .patch("/api/agents/my-agent/kill-switch")
        .send({ enabled: true, window_size: 50, threshold: 25 });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBeTruthy();
      expect(res.body.window_size).toBe(50);
      expect(res.body.threshold).toBe(25);
    });
  });

  describe("DELETE /api/agents/:agentId", () => {
    it("deletes an agent", async () => {
      createAgent("my-agent", "My Agent");

      const res = await request(app).delete("/api/agents/my-agent");

      expect(res.status).toBe(204);

      // Verify agent is deleted
      const checkRes = await request(app).get("/api/agents/my-agent");
      expect(checkRes.status).toBe(404);
    });

    it("returns 404 for non-existent agent", async () => {
      const res = await request(app).delete("/api/agents/non-existent");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Agent not found");
    });

    it("removes agent from list after deletion", async () => {
      createAgent("agent-1", "Agent One");
      createAgent("agent-2", "Agent Two");

      await request(app).delete("/api/agents/agent-1");

      const res = await request(app).get("/api/agents");
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].agent_id).toBe("agent-2");
    });
  });
});
