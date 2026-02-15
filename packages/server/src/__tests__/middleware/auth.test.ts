import { describe, it, expect, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { authMiddleware } from "../../middleware/auth.js";

describe("authMiddleware", () => {
  let app: Express;
  const TEST_TOKEN = "test-token-12345";

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.locals.token = TEST_TOKEN;
    app.use(authMiddleware);

    // Test routes
    app.get("/api/test", (_req, res) => res.json({ ok: true }));
    app.get("/api/health", (_req, res) => res.json({ status: "healthy" }));
    app.get("/api/auth/verify", (_req, res) => res.json({ valid: true }));
    app.get("/api/connection-info", (_req, res) => res.json({ connected: true }));
    app.get("/static/file.js", (_req, res) => res.send("// js"));
  });

  describe("protected endpoints", () => {
    it("allows access with valid Bearer token", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("allows access with valid x-api-key", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("x-api-key", TEST_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/test");

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Authentication required");
    });

    it("returns 401 with invalid token", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Authorization", "Bearer wrong-token");

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid token");
    });

    it("returns 401 with invalid x-api-key", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("x-api-key", "wrong-token");

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid token");
    });

    it("returns 401 when token length differs", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Authorization", "Bearer short");

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid token");
    });

    it("prefers Bearer token over x-api-key", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .set("x-api-key", "wrong-token");

      expect(res.status).toBe(200);
    });
  });

  describe("public endpoints", () => {
    it("allows /api/health without auth", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
    });

    it("allows /api/auth/verify without auth", async () => {
      const res = await request(app).get("/api/auth/verify");

      expect(res.status).toBe(200);
    });

    it("allows /api/connection-info without auth", async () => {
      const res = await request(app).get("/api/connection-info");

      expect(res.status).toBe(200);
    });
  });

  describe("non-API paths", () => {
    it("allows static files without auth", async () => {
      const res = await request(app).get("/static/file.js");

      expect(res.status).toBe(200);
    });
  });

  describe("public endpoint rate limiting", () => {
    it("rate limits public endpoints after too many requests", async () => {
      // Make many requests to a public endpoint
      const responses = [];
      for (let i = 0; i < 25; i++) {
        const res = await request(app).get("/api/health");
        responses.push(res);
      }

      // Should have at least one 429 response
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});
