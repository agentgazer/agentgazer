/**
 * Format a timestamp as a relative time string (e.g. "2 min ago").
 * Returns "Never" if the date is null or undefined.
 */
export function relativeTime(date: string | null | undefined): string {
  if (!date) return "Never";

  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "Just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Calculate health status from last_heartbeat_at.
 *   < 2 minutes  => healthy
 *   2-10 minutes => degraded
 *   > 10 minutes or null => down
 */
export function computeHealth(
  lastHeartbeat: string | null | undefined
): "healthy" | "degraded" | "down" {
  if (!lastHeartbeat) return "down";

  const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
  const minutes = diffMs / 1000 / 60;

  if (minutes < 2) return "healthy";
  if (minutes <= 10) return "degraded";
  return "down";
}

/**
 * Format USD cost values.
 */
export function formatCost(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return `$${value.toFixed(2)}`;
}
