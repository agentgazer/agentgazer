import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Simple in-memory token-bucket rate limiter.
// Keyed by the auth token (from Authorization header or x-api-key).
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const DEFAULT_MAX_TOKENS = 1000; // events per window
const DEFAULT_REFILL_INTERVAL_MS = 60_000; // 1 minute

const buckets = new Map<string, Bucket>();

function getOrCreateBucket(key: string): Bucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: DEFAULT_MAX_TOKENS, lastRefill: Date.now() };
    buckets.set(key, bucket);
  }
  return bucket;
}

function refill(bucket: Bucket): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const tokensToAdd = Math.floor(
      (elapsed / DEFAULT_REFILL_INTERVAL_MS) * DEFAULT_MAX_TOKENS,
    );
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(DEFAULT_MAX_TOKENS, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }
}

// Cleanup stale buckets every 5 minutes to prevent unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 5 * 60_000) {
      buckets.delete(key);
    }
  }
}, 5 * 60_000).unref();

/**
 * Rate-limiting middleware for the event ingestion endpoint.
 * Allows up to 1000 events per minute per API key.
 * Counts each event in a batch individually.
 */
export function rateLimitEvents(req: Request, res: Response, next: NextFunction): void {
  // Extract the API key used for auth
  const authHeader = req.headers["authorization"];
  const apiKeyHeader = req.headers["x-api-key"];
  const key =
    (typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null) ??
    (typeof apiKeyHeader === "string" ? apiKeyHeader : "anonymous");

  const bucket = getOrCreateBucket(key);
  refill(bucket);

  // Count how many events are in this request
  const body = req.body as { events?: unknown[] } | Record<string, unknown>;
  const eventCount =
    body && "events" in body && Array.isArray(body.events)
      ? body.events.length
      : 1;

  if (bucket.tokens < eventCount) {
    res.status(429).json({
      error: "Rate limit exceeded. Maximum 1000 events per minute.",
      retry_after_ms: DEFAULT_REFILL_INTERVAL_MS,
    });
    return;
  }

  bucket.tokens -= eventCount;
  next();
}
