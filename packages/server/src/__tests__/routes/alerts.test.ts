import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { initDatabase } from "../../db.js";
import alertsRouter from "../../routes/alerts.js";

describe("alerts routes", () => {
  let app: express.Express;
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  /** Helper to create an agent directly in the database */
  function createAgent(agentId: string): void {
    const stmt = db.prepare(`
      INSERT INTO agents (id, agent_id, name, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(randomUUID(), agentId, agentId);
  }

  /** Helper to create an alert rule directly in the database */
  function createAlertRule(params: {
    id?: string;
    agent_id: string;
    rule_type: string;
    config?: Record<string, unknown>;
    enabled?: number;
    webhook_url?: string;
    notification_type?: string;
  }): string {
    const id = params.id ?? randomUUID();
    const stmt = db.prepare(`
      INSERT INTO alert_rules (id, agent_id, rule_type, config, enabled, notification_type, webhook_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(
      id,
      params.agent_id,
      params.rule_type,
      JSON.stringify(params.config ?? {}),
      params.enabled ?? 1,
      params.notification_type ?? "webhook",
      params.webhook_url ?? "https://example.com/webhook"
    );
    return id;
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alerts-routes-test-"));
    dbPath = path.join(tempDir, "test.db");

    db = initDatabase({ path: dbPath });

    app = express();
    app.use(express.json());
    app.locals.db = db;
    app.use(alertsRouter);
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("GET /api/alerts", () => {
    it("returns empty list when no alerts exist", async () => {
      const res = await request(app).get("/api/alerts");

      expect(res.status).toBe(200);
      expect(res.body.alerts).toEqual([]);
    });

    it("returns all alerts without pagination params", async () => {
      createAgent("my-agent");
      createAlertRule({ agent_id: "my-agent", rule_type: "error_rate", config: { threshold: 0.1 } });
      createAlertRule({ agent_id: "my-agent", rule_type: "budget", config: { limit: 100 } });

      const res = await request(app).get("/api/alerts");

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(2);
    });

    it("returns paginated results", async () => {
      createAgent("my-agent");
      for (let i = 0; i < 5; i++) {
        createAlertRule({ agent_id: "my-agent", rule_type: "error_rate", config: { threshold: 0.1 } });
      }

      const res = await request(app).get("/api/alerts?limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it("filters by agent_id", async () => {
      createAgent("agent-1");
      createAgent("agent-2");
      createAlertRule({ agent_id: "agent-1", rule_type: "error_rate" });
      createAlertRule({ agent_id: "agent-2", rule_type: "budget" });

      const res = await request(app).get("/api/alerts?agent_id=agent-1");

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.alerts[0].agent_id).toBe("agent-1");
    });

    it("filters by rule_type", async () => {
      createAgent("my-agent");
      createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });
      createAlertRule({ agent_id: "my-agent", rule_type: "budget" });

      const res = await request(app).get("/api/alerts?rule_type=budget");

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.alerts[0].rule_type).toBe("budget");
    });
  });

  describe("POST /api/alerts", () => {
    it("creates a new alert rule with webhook", async () => {
      createAgent("my-agent");

      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          webhook_url: "https://example.com/webhook",
        });

      expect(res.status).toBe(201);
      expect(res.body.agent_id).toBe("my-agent");
      expect(res.body.rule_type).toBe("error_rate");
      expect(res.body.id).toBeDefined();
    });

    it("returns 400 if agent_id is missing", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          webhook_url: "https://example.com/webhook",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("agent_id");
    });

    it("returns 400 if rule_type is missing", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          config: { threshold: 0.1 },
          webhook_url: "https://example.com/webhook",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("rule_type");
    });

    it("returns 400 for invalid rule_type", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "invalid_type",
          config: {},
          webhook_url: "https://example.com/webhook",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("rule_type must be one of");
    });

    it("returns 400 if config is missing", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          webhook_url: "https://example.com/webhook",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("config");
    });

    it("returns 400 if webhook_url is missing for webhook notification", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          notification_type: "webhook",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("webhook_url");
    });

    it("returns 400 for invalid webhook_url", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          webhook_url: "not-a-url",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("valid URL");
    });

    it("returns 400 if smtp_config is missing for email notification", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          notification_type: "email",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("smtp_config");
    });

    it("returns 400 if smtp_config missing required fields", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          notification_type: "email",
          smtp_config: { host: "smtp.example.com" }, // missing from, to
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("from");
    });

    it("creates alert with email notification", async () => {
      createAgent("my-agent");

      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          notification_type: "email",
          smtp_config: {
            host: "smtp.example.com",
            port: 587,
            from: "alerts@example.com",
            to: "user@example.com",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.notification_type).toBe("email");
    });

    it("returns 400 if telegram_config is missing for telegram notification", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          notification_type: "telegram",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("telegram_config");
    });

    it("returns 400 for invalid budget_period", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "budget",
          config: { limit: 100 },
          webhook_url: "https://example.com/webhook",
          budget_period: "invalid",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("budget_period");
    });

    it("returns 400 for invalid repeat_interval_minutes", async () => {
      const res = await request(app)
        .post("/api/alerts")
        .send({
          agent_id: "my-agent",
          rule_type: "error_rate",
          config: { threshold: 0.1 },
          webhook_url: "https://example.com/webhook",
          repeat_interval_minutes: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("repeat_interval_minutes");
    });

    it("accepts all valid rule types", async () => {
      createAgent("my-agent");
      const validTypes = ["agent_down", "error_rate", "budget", "kill_switch", "security_event"];

      for (const ruleType of validTypes) {
        const res = await request(app)
          .post("/api/alerts")
          .send({
            agent_id: "my-agent",
            rule_type: ruleType,
            config: { threshold: 0.1 },
            webhook_url: "https://example.com/webhook",
          });

        expect(res.status).toBe(201);
        expect(res.body.rule_type).toBe(ruleType);
      }
    });
  });

  describe("PUT /api/alerts/:id", () => {
    it("updates alert rule", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      const res = await request(app)
        .put(`/api/alerts/${alertId}`)
        .send({
          enabled: false,
          config: { threshold: 0.2 },
        });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.config.threshold).toBe(0.2);
    });

    it("returns 404 for non-existent alert", async () => {
      const res = await request(app)
        .put(`/api/alerts/${randomUUID()}`)
        .send({ enabled: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("updates webhook_url", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      const res = await request(app)
        .put(`/api/alerts/${alertId}`)
        .send({
          webhook_url: "https://new-webhook.com/alert",
        });

      expect(res.status).toBe(200);
      expect(res.body.webhook_url).toBe("https://new-webhook.com/alert");
    });

    it("validates webhook_url when updating", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      const res = await request(app)
        .put(`/api/alerts/${alertId}`)
        .send({
          webhook_url: "not-a-url",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("valid URL");
    });
  });

  describe("DELETE /api/alerts/:id", () => {
    it("deletes alert rule", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      const res = await request(app).delete(`/api/alerts/${alertId}`);

      expect(res.status).toBe(204);

      // Verify deleted
      const checkRes = await request(app).get(`/api/alerts/${alertId}`);
      expect(checkRes.status).toBe(404);
    });

    it("returns 404 for non-existent alert", async () => {
      const res = await request(app).delete(`/api/alerts/${randomUUID()}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });
  });

  describe("GET /api/alert-history", () => {
    it("returns empty list when no history exists", async () => {
      const res = await request(app).get("/api/alert-history");

      expect(res.status).toBe(200);
      expect(res.body.history).toEqual([]);
    });

    it("returns history with limit", async () => {
      // Insert some history records
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      // Add history entries
      for (let i = 0; i < 5; i++) {
        db.prepare(`
          INSERT INTO alert_history (id, alert_rule_id, agent_id, rule_type, message, delivered_via, delivered_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(randomUUID(), alertId, "my-agent", "error_rate", `Alert ${i}`, "webhook");
      }

      const res = await request(app).get("/api/alert-history?limit=2");

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(2);
    });

    it("returns paginated results with offset", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      // Add history entries
      for (let i = 0; i < 5; i++) {
        db.prepare(`
          INSERT INTO alert_history (id, alert_rule_id, agent_id, rule_type, message, delivered_via, delivered_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(randomUUID(), alertId, "my-agent", "error_rate", `Alert ${i}`, "webhook");
      }

      const res = await request(app).get("/api/alert-history?limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it("filters history by agent_id", async () => {
      createAgent("agent-1");
      createAgent("agent-2");
      const alertId1 = createAlertRule({ agent_id: "agent-1", rule_type: "error_rate" });
      const alertId2 = createAlertRule({ agent_id: "agent-2", rule_type: "budget" });

      db.prepare(`
        INSERT INTO alert_history (id, alert_rule_id, agent_id, rule_type, message, delivered_via, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(randomUUID(), alertId1, "agent-1", "error_rate", "Alert 1", "webhook");

      db.prepare(`
        INSERT INTO alert_history (id, alert_rule_id, agent_id, rule_type, message, delivered_via, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(randomUUID(), alertId2, "agent-2", "budget", "Alert 2", "webhook");

      const res = await request(app).get("/api/alert-history?agent_id=agent-1");

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0].agent_id).toBe("agent-1");
    });
  });

  describe("PATCH /api/alerts/:id/toggle", () => {
    it("toggles alert enabled status", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate", enabled: 1 });

      const res = await request(app)
        .patch(`/api/alerts/${alertId}/toggle`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });

    it("returns 400 if enabled is missing", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      const res = await request(app)
        .patch(`/api/alerts/${alertId}/toggle`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("enabled");
    });

    it("returns 404 for non-existent alert", async () => {
      const res = await request(app)
        .patch(`/api/alerts/${randomUUID()}/toggle`)
        .send({ enabled: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });
  });

  describe("POST /api/alerts/:id/reset", () => {
    it("resets alert state to normal", async () => {
      createAgent("my-agent");
      const alertId = createAlertRule({ agent_id: "my-agent", rule_type: "error_rate" });

      // Set alert to triggered state
      db.prepare(`UPDATE alert_rules SET state = 'triggered', last_triggered_at = datetime('now') WHERE id = ?`)
        .run(alertId);

      const res = await request(app).post(`/api/alerts/${alertId}/reset`);

      expect(res.status).toBe(200);
      expect(res.body.state).toBe("normal");
      expect(res.body.last_triggered_at).toBeNull();
    });

    it("returns 404 for non-existent alert", async () => {
      const res = await request(app).post(`/api/alerts/${randomUUID()}/reset`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });
  });
});
