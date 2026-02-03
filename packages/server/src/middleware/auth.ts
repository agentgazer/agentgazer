import type { Request, Response, NextFunction } from "express";

const PUBLIC_PATHS = ["/api/health", "/api/auth/verify"];

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for public paths
  if (PUBLIC_PATHS.includes(req.path)) {
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
