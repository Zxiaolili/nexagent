/** SQLite legacy format: UTC instant stored without timezone suffix. */
const LEGACY_SQL_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * Normalizes API timestamps so clients parse them as UTC (ISO 8601 with Z).
 * Legacy rows use space-separated UTC from SQLite datetime('now').
 */
export function normalizeStoredTimestamp(s: string): string {
  if (!s) return s;
  if (LEGACY_SQL_UTC.test(s)) return `${s.replace(" ", "T")}Z`;
  return s;
}
