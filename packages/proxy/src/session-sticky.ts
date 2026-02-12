/**
 * Session Sticky - Ensures conversation continuity by keeping
 * the same agent's requests going to the same provider channel.
 *
 * This helps avoid context loss when switching providers mid-conversation.
 */

export interface StickySession {
  agentId: string;
  model: string;
  provider: string;
  lastActiveAt: number;
  requestCount: number;
}

interface SessionStore {
  [key: string]: StickySession;
}

// In-memory session store
// Key format: `${agentId}:${model}`
const sessions: SessionStore = {};

// Default session TTL: 30 minutes of inactivity
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

let sessionTtlMs = DEFAULT_SESSION_TTL_MS;

/**
 * Configure session TTL
 */
export function setSessionTtl(ttlMs: number): void {
  sessionTtlMs = ttlMs;
}

/**
 * Get session TTL
 */
export function getSessionTtl(): number {
  return sessionTtlMs;
}

/**
 * Generate session key from agent ID and model
 */
function makeSessionKey(agentId: string, model: string): string {
  return `${agentId}:${model.toLowerCase()}`;
}

/**
 * Get sticky session for an agent/model combination
 * Returns null if no session exists or session has expired
 */
export function getSticky(agentId: string, model: string): StickySession | null {
  const key = makeSessionKey(agentId, model);
  const session = sessions[key];

  if (!session) return null;

  // Check if session has expired
  if (Date.now() - session.lastActiveAt > sessionTtlMs) {
    delete sessions[key];
    return null;
  }

  return session;
}

/**
 * Set or update sticky session
 * Called after a successful request to a provider
 */
export function setSticky(
  agentId: string,
  model: string,
  provider: string
): StickySession {
  const key = makeSessionKey(agentId, model);
  const existing = sessions[key];

  if (existing && existing.provider === provider) {
    // Update existing session
    existing.lastActiveAt = Date.now();
    existing.requestCount++;
    return existing;
  }

  // Create new session (or override if provider changed)
  const session: StickySession = {
    agentId,
    model: model.toLowerCase(),
    provider,
    lastActiveAt: Date.now(),
    requestCount: 1,
  };

  sessions[key] = session;
  return session;
}

/**
 * Clear sticky session for an agent/model
 * Called when a provider fails and we need to try a different one
 */
export function clearSticky(agentId: string, model: string): void {
  const key = makeSessionKey(agentId, model);
  delete sessions[key];
}

/**
 * Clear all sessions for an agent
 */
export function clearAgentSessions(agentId: string): number {
  let cleared = 0;
  for (const key of Object.keys(sessions)) {
    if (key.startsWith(`${agentId}:`)) {
      delete sessions[key];
      cleared++;
    }
  }
  return cleared;
}

/**
 * Get all active sessions (for debugging/monitoring)
 */
export function getAllSessions(): StickySession[] {
  const now = Date.now();
  const activeSessions: StickySession[] = [];

  for (const [key, session] of Object.entries(sessions)) {
    if (now - session.lastActiveAt <= sessionTtlMs) {
      activeSessions.push(session);
    } else {
      // Clean up expired session
      delete sessions[key];
    }
  }

  return activeSessions;
}

/**
 * Get session count (for metrics)
 */
export function getSessionCount(): number {
  return getAllSessions().length;
}

/**
 * Cleanup expired sessions
 * Called periodically to prevent memory leaks
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, session] of Object.entries(sessions)) {
    if (now - session.lastActiveAt > sessionTtlMs) {
      delete sessions[key];
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions(): void {
  for (const key of Object.keys(sessions)) {
    delete sessions[key];
  }
}
