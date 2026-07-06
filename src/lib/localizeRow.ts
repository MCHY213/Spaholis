import type { Language } from "@/i18n";

/**
 * Overlay `*_es` columns onto their base fields when language is "es".
 *
 * Fallback: if the Spanish value is null / undefined / empty string / empty
 * object / empty array, the English base value is kept. This guarantees the
 * UI never breaks when a translation is missing.
 *
 * Example:
 *   localizeRow(service, "es", ["title", "description", "description_rich"])
 *   → { ...service, title: service.title_es || service.title, ... }
 *
 * Returns the row unchanged when language is "en".
 */
export function localizeRow<T extends Record<string, any>>(
  row: T,
  lang: Language,
  fields: string[]
): T {
  if (!row || lang !== "es") return row;
  const out: any = { ...row };
  for (const f of fields) {
    const esKey = `${f}_es`;
    if (!(esKey in row)) continue;
    const esVal = (row as any)[esKey];
    if (isMeaningful(esVal)) out[f] = esVal;
  }
  return out as T;
}

export function localizeRows<T extends Record<string, any>>(
  rows: T[] | null | undefined,
  lang: Language,
  fields: string[]
): T[] {
  if (!rows) return [];
  if (lang !== "es") return rows;
  return rows.map((r) => localizeRow(r, lang, fields));
}

function isMeaningful(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}
