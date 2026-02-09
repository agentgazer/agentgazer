import * as http from "node:http";
import * as path from "node:path";
import express from "express";
import cors from "cors";
import { createLogger } from "@agentgazer/shared";
import { initDatabase, purgeOldData } from "./db.js";

const log = createLogger("server");
import { authMiddleware } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import agentsRouter from "./routes/agents.js";
import eventsRouter from "./routes/events.js";
import statsRouter from "./routes/stats.js";
import alertsRouter from "./routes/alerts.js";
import modelRulesRouter from "./routes/model-rules.js";
import rateLimitsRouter from "./routes/rate-limits.js";
import { createProvidersRouter } from "./routes/providers.js";
import { createOverviewRouter } from "./routes/overview.js";
import { createOpenclawRouter } from "./routes/openclaw.js";
import { createSettingsRouter } from "./routes/settings.js";
import { startEvaluator } from "./alerts/evaluator.js";

export interface SecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, secret: string): Promise<void>;
  delete(service: string, account: string): Promise<void | boolean>;
  list(service: string): Promise<string[]>;
}

export interface ServerOptions {
  port?: number;
  token: string;
  dbPath: string;
  dashboardDir?: string;
  retentionDays?: number;
  secretStore?: SecretStore;
  configPath?: string;
}

export function createServer(options: ServerOptions): { app: express.Express; db: ReturnType<typeof initDatabase> } {
  const db = initDatabase({ path: options.dbPath });

  const app = express();

  // Store shared state on app.locals
  app.locals.db = db;
  app.locals.token = options.token;
  app.locals.startTime = Date.now();

  // Middleware
  app.use(cors({
    origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  }));
  app.use(express.json({ limit: "5mb" }));
  app.use(authMiddleware);

  // API routes
  app.use(healthRouter);
  app.use(authRouter);
  app.use(agentsRouter);
  app.use(eventsRouter);
  app.use(statsRouter);
  app.use(alertsRouter);
  app.use(modelRulesRouter);
  app.use(rateLimitsRouter);
  app.use("/api/providers", createProvidersRouter({ db, secretStore: options.secretStore }));
  app.use("/api", createProvidersRouter({ db, secretStore: options.secretStore })); // for /api/connection-info
  app.use("/api/overview", createOverviewRouter({ db, startTime: app.locals.startTime }));
  app.use("/api/openclaw", createOpenclawRouter());
  if (options.configPath) {
    app.use(createSettingsRouter({ configPath: options.configPath }));
  }

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
): Promise<{ server: http.Server; db: ReturnType<typeof initDatabase>; shutdown: () => Promise<void> }> {
  const port = options.port ?? 8080;
  const { app, db } = createServer(options);

  // Start alert evaluator
  const evaluator = startEvaluator({ db });

  // Start data retention cleanup (runs on startup and every 24h)
  const retentionDays = options.retentionDays ?? 30;
  let retentionTimer: ReturnType<typeof setInterval> | null = null;

  let retentionRetryTimer: ReturnType<typeof setTimeout> | null = null;

  function runRetention(): void {
    try {
      const { eventsDeleted, historyDeleted } = purgeOldData(db, retentionDays);
      if (eventsDeleted > 0 || historyDeleted > 0) {
        log.info("Retention cleanup complete", { eventsDeleted, historyDeleted, retentionDays });
      }
    } catch (err) {
      log.error("Retention cleanup failed, will retry in 1 hour", { err: String(err) });
      retentionRetryTimer = setTimeout(runRetention, 60 * 60 * 1000);
      retentionRetryTimer.unref();
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
    if (retentionRetryTimer) clearTimeout(retentionRetryTimer);
    return new Promise((resolve, reject) => {
      const shutdownTimeout = setTimeout(() => {
        log.warn("Shutdown timed out, forcing close");
        try { db.close(); } catch { /* ignore */ }
        resolve();
      }, 10_000);
      shutdownTimeout.unref();

      server.close((err) => {
        clearTimeout(shutdownTimeout);
        try { db.close(); } catch { /* ignore */ }
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { server, db, shutdown };
}
