import type { Locale } from "@/lib/i18n";

const LEGACY_SQL_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Parses server timestamps (ISO Z or legacy SQLite UTC) to epoch ms. */
export function parseStoredInstantMs(dateStr: string): number {
  const s = dateStr.trim();
  if (LEGACY_SQL_UTC.test(s)) return Date.parse(`${s.replace(" ", "T")}Z`);
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

export function formatLocalDateTime(dateStr: string, locale: Locale): string {
  const ms = parseStoredInstantMs(dateStr);
  if (Number.isNaN(ms)) return dateStr;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ms));
}
