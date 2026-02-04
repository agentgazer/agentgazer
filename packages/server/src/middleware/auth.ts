import type { Request, Response, NextFunction } from "express";

const PUBLIC_PATHS = ["/api/health", "/api/auth/verify"];

// Simple rate limiting for public endpoints (e.g. token brute-force on /api/auth/verify)
const publicRateMap = new Map<string, { count: number; resetAt: number }>();
const PUBLIC_RATE_MAX = 20;
const PUBLIC_RATE_WINDOW_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of publicRateMap) {
    if (now >= entry.resetAt) publicRateMap.delete(key);
  }
}, 5 * 60_000).unref();

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for public paths (with rate limiting)
  if (PUBLIC_PATHS.includes(req.path)) {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const entry = publicRateMap.get(ip);
    if (entry && now < entry.resetAt && entry.count >= PUBLIC_RATE_MAX) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    if (!entry || now >= entry.resetAt) {
      publicRateMap.set(ip, { count: 1, resetAt: now + PUBLIC_RATE_WINDOW_MS });
    } else {
      entry.count++;
    }
    next();
    return;
  }

  // Extract token from Authorization header or x-api-key header
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey === "string") {
      token = apiKey;
    }
  }

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const expectedToken = req.app.locals.token as string;
  if (token !== expectedToken) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  next();
}
