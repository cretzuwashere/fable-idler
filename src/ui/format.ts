// format.ts — UI-only time/text helpers. All NUMBER formatting lives in the
// engine (formatNumber/formatRate) — these are duration/ETA presenters only.

/** "1h 24m", "3m 12s", "45s" — for the offline modal. */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const minutes = Math.floor((totalSec % 3_600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Short ETA for expensive buy buttons: "~12s", "~3m", "~2h". Null if unknowable. */
export function formatEta(missing: number, perSec: number): string | null {
  if (!(perSec > 0) || !(missing > 0)) return null;
  const sec = missing / perSec;
  if (sec < 1) return '~1s';
  if (sec < 90) return `~${Math.ceil(sec)}s`;
  if (sec < 90 * 60) return `~${Math.ceil(sec / 60)}m`;
  if (sec < 48 * 3600) return `~${Math.ceil(sec / 3600)}h`;
  return `~${Math.ceil(sec / 86_400)}d`;
}
