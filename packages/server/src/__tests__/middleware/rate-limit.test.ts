import { describe, it, expect, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { rateLimitEvents } from "../../middleware/rate-limit.js";

describe("rateLimitEvents middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Apply rate limiter before test route
    app.post("/api/events", rateLimitEvents, (req, res) => {
      const events = req.body.events || [req.body];
      res.json({ accepted: events.length });
    });
  });

  describe("single event requests", () => {
    it("allows single event", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-token-single")
        .send({ agent_id: "test", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() });

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(1);
    });

    it("allows many single events within limit", async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post("/api/events")
          .set("Authorization", "Bearer test-token-many-single")
          .send({ agent_id: "test", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() });

        expect(res.status).toBe(200);
      }
    });
  });

  describe("batch event requests", () => {
    it("allows batch of events within limit", async () => {
      const events = Array.from({ length: 10 }, () => ({
        agent_id: "test",
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
      }));

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-token-batch")
        .send({ events });

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(10);
    });

    it("counts each event in batch against limit", async () => {
      // Each key gets 1000 tokens per minute
      // Send a large batch that should consume many tokens
      const events = Array.from({ length: 500 }, () => ({
        agent_id: "test",
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
      }));

      const res1 = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-token-large-batch")
        .send({ events });

      expect(res1.status).toBe(200);

      // Second batch should also succeed (still have 500 tokens)
      const res2 = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-token-large-batch")
        .send({ events });

      expect(res2.status).toBe(200);

      // Third batch should fail (exceeded 1000)
      const res3 = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-token-large-batch")
        .send({ events });

      expect(res3.status).toBe(429);
      expect(res3.body.error).toContain("Rate limit exceeded");
      expect(res3.body.retry_after_ms).toBeDefined();
    });
  });

  describe("per-key isolation", () => {
    it("rate limits are per API key", async () => {
      // Exhaust key A
      const events = Array.from({ length: 1001 }, () => ({
        agent_id: "test",
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
      }));

      await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-key-A-isolated")
        .send({ events });

      // Key B should still work
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-key-B-isolated")
        .send({ events: events.slice(0, 10) });

      expect(res.status).toBe(200);
    });
  });

  describe("anonymous requests", () => {
    it("handles requests without auth headers", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({ agent_id: "test", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() });

      expect(res.status).toBe(200);
    });
  });

  describe("x-api-key header", () => {
    it("uses x-api-key for rate limiting", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("x-api-key", "test-api-key-header")
        .send({ agent_id: "test", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() });

      expect(res.status).toBe(200);
    });
  });

  describe("rate limit response", () => {
    it("returns 429 with retry information", async () => {
      const events = Array.from({ length: 1001 }, () => ({
        agent_id: "test",
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
      }));

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", "Bearer test-key-429-response")
        .send({ events });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain("Rate limit exceeded");
      expect(res.body.retry_after_ms).toBe(60000);
    });
  });
});
