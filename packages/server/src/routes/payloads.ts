import { Router } from "express";
import { getPayloadStore } from "../payload-store.js";
import { createLogger } from "@agentgazer/shared";

const log = createLogger("routes/payloads");

export function createPayloadsRouter(): Router {
  const router = Router();

  /**
   * POST /api/payloads
   * Archive a payload (from proxy).
   */
  router.post("/", (req, res) => {
    const store = getPayloadStore();
    if (!store) {
      res.status(503).json({ error: "Payload storage not enabled" });
      return;
    }

    const { eventId, agentId, requestBody, responseBody } = req.body;

    if (!eventId || !agentId) {
      res.status(400).json({ error: "Missing required fields: eventId, agentId" });
      return;
    }

    try {
      store.queue(eventId, agentId, requestBody ?? null, responseBody ?? null);
      res.status(201).json({ queued: true });
    } catch (err) {
      log.error("Failed to queue payload", { err: String(err) });
      res.status(500).json({ error: "Failed to queue payload" });
    }
  });

  /**
   * POST /api/payloads/evidence
   * Save kill switch evidence (from proxy).
   */
  router.post("/evidence", (req, res) => {
    const store = getPayloadStore();
    if (!store) {
      res.status(503).json({ error: "Payload storage not enabled" });
      return;
    }

    const { killSwitchEventId, payloads } = req.body;

    if (!killSwitchEventId || !Array.isArray(payloads)) {
      res.status(400).json({ error: "Missing required fields: killSwitchEventId, payloads" });
      return;
    }

    try {
      const saved = store.saveEvidence(killSwitchEventId, payloads);
      res.status(201).json({ saved });
    } catch (err) {
      log.error("Failed to save evidence", { err: String(err) });
      res.status(500).json({ error: "Failed to save evidence" });
    }
  });

  /**
   * GET /api/payloads/stats
   * Get payload storage statistics.
   * Note: Must be defined before /:eventId to avoid matching "stats" as eventId
   */
  router.get("/stats", (req, res) => {
    const store = getPayloadStore();
    if (!store) {
      res.json({ enabled: false, archive: 0, evidence: 0, totalSize: 0 });
      return;
    }

    try {
      const stats = store.getStats();
      res.json({ enabled: true, ...stats });
    } catch (err) {
      log.error("Failed to get stats", { err: String(err) });
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  /**
   * GET /api/payloads/evidence/:killSwitchEventId
   * Get all evidence payloads for a kill switch event.
   * Note: Must be defined before /:eventId to avoid matching "evidence" as eventId
   */
  router.get("/evidence/:killSwitchEventId", (req, res) => {
    const store = getPayloadStore();
    if (!store) {
      res.status(503).json({ error: "Payload storage not enabled" });
      return;
    }

    const { killSwitchEventId } = req.params;

    try {
      const payloads = store.getEvidenceByKillSwitch(killSwitchEventId);
      res.json({
        killSwitchEventId,
        payloads,
        count: payloads.length,
      });
    } catch (err) {
      log.error("Failed to get evidence", { err: String(err) });
      res.status(500).json({ error: "Failed to get evidence" });
    }
  });

  /**
   * DELETE /api/payloads/archive
   * Clear all archived payloads (not evidence).
   * Note: Must be defined before /:eventId to avoid matching "archive" as eventId
   */
  router.delete("/archive", (req, res) => {
    const store = getPayloadStore();
    if (!store) {
      res.status(503).json({ error: "Payload storage not enabled" });
      return;
    }

    try {
      const deleted = store.clearArchive();
      res.json({ deleted });
    } catch (err) {
      log.error("Failed to clear archive", { err: String(err) });
      res.status(500).json({ error: "Failed to clear archive" });
    }
  });

  /**
   * GET /api/payloads/:eventId
   * Get payload by event ID.
   * Note: This catch-all route must be defined last
   */
  router.get("/:eventId", (req, res) => {
    const store = getPayloadStore();
    if (!store) {
      res.status(503).json({ error: "Payload storage not enabled" });
      return;
    }

    const { eventId } = req.params;

    try {
      const payload = store.getByEventId(eventId);
      if (!payload) {
        res.status(404).json({ error: "Payload not found" });
        return;
      }
      res.json(payload);
    } catch (err) {
      log.error("Failed to get payload", { err: String(err) });
      res.status(500).json({ error: "Failed to get payload" });
    }
  });

  return router;
}
