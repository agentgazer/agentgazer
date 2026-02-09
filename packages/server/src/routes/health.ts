import { Router } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read version from package.json using CommonJS-compatible approach
let version = "unknown";
try {
  const pkgPath = resolve(__dirname, "../../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
  version = pkg.version;
} catch {
  // Fallback if package.json not found
}

const router = Router();

router.get("/api/health", (req, res) => {
  const startTime = req.app.locals.startTime as number;
  res.json({
    status: "ok",
    version,
    uptime_ms: Date.now() - startTime,
  });
});

export default router;
