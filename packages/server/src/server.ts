import * as http from "node:http";
import * as path from "node:path";
import express from "express";
import cors from "cors";
import { createLogger } from "@agenttrace/shared";
import { initDatabase, purgeOldData } from "./db.js";

const log = createLogger("server");
import { authMiddleware } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import agentsRouter from "./routes/agents.js";
import eventsRouter from "./routes/events.js";
import statsRouter from "./routes/stats.js";
import alertsRouter from "./routes/alerts.js";
import { startEvaluator } from "./alerts/evaluator.js";

export interface ServerOptions {
  port?: number;
  token: string;
  dbPath: string;
  dashboardDir?: string;
  retentionDays?: number;
}

export function createServer(options: ServerOptions): { app: express.Express; db: ReturnType<typeof initDatabase> } {
  const db = initDatabase({ path: options.dbPath });

  const app = express();

  // Store shared state on app.locals
  app.locals.db = db;
  app.locals.token = options.token;
  app.locals.startTime = Date.now();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(authMiddleware);

  // API routes
  app.use(healthRouter);
  app.use(authRouter);
  app.use(agentsRouter);
  app.use(eventsRouter);
  app.use(statsRouter);
  app.use(alertsRouter);

  // Serve dashboard static files if a directory is provided
  if (options.dashboardDir) {
    app.use(express.static(options.dashboardDir));

    // SPA fallback: all non-API routes serve index.html
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.sendFile(path.join(options.dashboardDir!, "index.html"));
    });
  }

  return { app, db };
}

export async function startServer(
  options: ServerOptions,
): Promise<{ server: http.Server; shutdown: () => Promise<void> }> {
  const port = options.port ?? 8080;
  const { app, db } = createServer(options);

  // Start alert evaluator
  const evaluator = startEvaluator({ db });

  // Start data retention cleanup (runs on startup and every 24h)
  const retentionDays = options.retentionDays ?? 30;
  let retentionTimer: ReturnType<typeof setInterval> | null = null;

  function runRetention(): void {
    try {
      const { eventsDeleted, historyDeleted } = purgeOldData(db, retentionDays);
      if (eventsDeleted > 0 || historyDeleted > 0) {
        log.info("Retention cleanup complete", { eventsDeleted, historyDeleted, retentionDays });
      }
    } catch (err) {
      log.error("Retention cleanup failed", { err: String(err) });
    }
  }

  runRetention();
  retentionTimer = setInterval(runRetention, 24 * 60 * 60 * 1000);
  retentionTimer.unref();

  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => resolve());
  });

  async function shutdown(): Promise<void> {
    evaluator.stop();
    if (retentionTimer) clearInterval(retentionTimer);
    return new Promise((resolve, reject) => {
      server.close((err) => {
        db.close();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { server, shutdown };
}
