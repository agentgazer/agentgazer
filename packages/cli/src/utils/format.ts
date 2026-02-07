export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatUptime(startTime: Date): string {
  const diff = Date.now() - startTime.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60) % 60;
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${minutes}m`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "--";
  return `${formatNumber(ms)}ms`;
}

export function parseRange(range: string): number {
  const match = range.match(/^(\d+)([hdwm])$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "m":
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}
