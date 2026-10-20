/**
 * KST (Korea Standard Time, UTC+9) Timezone Utilities
 *
 * Cloudflare Workers run in UTC — these helpers produce
 * KST-aware dates for business logic and cron jobs.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // +9 hours in ms

/**
 * Returns the current Date adjusted to KST.
 * The returned Date object's UTC methods (getUTCHours, etc.) reflect KST values.
 *
 * Example: if UTC is 2026-04-21T15:00:00Z, this returns a Date
 * whose getUTCHours() === 0 (i.e. KST midnight on the 22nd).
 */
export function nowKST(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

/**
 * Returns today's date string in KST as "YYYY-MM-DD".
 */
export function todayKSTString(): string {
  const kst = nowKST();
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the start of today in KST as an ISO string (UTC representation).
 * Useful for DB queries like `WHERE created_at >= kstStartOfDay()`.
 *
 * Example: KST 2026-04-22 00:00:00 → UTC "2026-04-21T15:00:00.000Z"
 */
export function kstStartOfDay(date?: Date): string {
  const kst = date ? new Date(date.getTime() + KST_OFFSET_MS) : nowKST();
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  // KST midnight → subtract offset to get UTC
  const utcMidnight = new Date(Date.UTC(y, m, d) - KST_OFFSET_MS);
  return utcMidnight.toISOString();
}

/**
 * Format a date (or "now") into a KST string.
 *
 * @param date  — Date object or ISO string (interpreted as UTC)
 * @param fmt   — "datetime" (default) | "date" | "time"
 *
 * Examples:
 *   formatKST(new Date(), 'datetime') → "2026-04-22 00:30:15"
 *   formatKST(new Date(), 'date')     → "2026-04-22"
 *   formatKST(new Date(), 'time')     → "00:30:15"
 */
export function formatKST(
  date?: Date | string | null,
  fmt: 'datetime' | 'date' | 'time' = 'datetime'
): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const kst = new Date(d.getTime() + KST_OFFSET_MS);

  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  const s = String(kst.getUTCSeconds()).padStart(2, '0');

  if (fmt === 'date') return `${y}-${mo}-${day}`;
  if (fmt === 'time') return `${h}:${mi}:${s}`;
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
}
