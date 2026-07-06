import type { Language } from "@/i18n";

/**
 * Pick a localized field from a row that has both `field` and `field_es`.
 * Fallback chain: requested language → English → empty.
 *
 * Example: pickLocalized(service, "title", "es") returns
 *   service.title_es || service.title || ""
 */
export function pickLocalized<T extends Record<string, unknown>>(
  row: T | null | undefined,
  field: string,
  lang: Language
): string {
  if (!row) return "";
  if (lang === "es") {
    const esVal = row[`${field}_es`];
    if (typeof esVal === "string" && esVal.trim().length > 0) return esVal;
  }
  const enVal = row[field];
  if (typeof enVal === "string") return enVal;
  return "";
}

/** Same as pickLocalized but for jsonb / object fields (returns the raw value). */
export function pickLocalizedJson<T extends Record<string, unknown>>(
  row: T | null | undefined,
  field: string,
  lang: Language
): unknown {
  if (!row) return null;
  if (lang === "es") {
    const esVal = row[`${field}_es`];
    if (esVal != null && !(typeof esVal === "object" && esVal !== null && Object.keys(esVal).length === 0)) {
      // also reject empty arrays
      if (Array.isArray(esVal) ? esVal.length > 0 : true) return esVal;
    }
  }
  return row[field] ?? null;
}
