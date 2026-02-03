import { Router } from "express";

const router = Router();

router.get("/api/health", (req, res) => {
  const startTime = req.app.locals.startTime as number;
  res.json({
    status: "ok",
    uptime_ms: Date.now() - startTime,
  });
});

export default router;
