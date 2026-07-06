/**
 * WhatsApp runtime validators.
 *
 * The canonical number lives in the content/data layer
 * (src/data/contact.ts) — this module only re-exports it and adds
 * runtime guards so a CMS typo or hardcode drift can never send
 * customers to the wrong chat.
 */
export {
  HOLIS_WHATSAPP_NUMBER,
  HOLIS_WHATSAPP_URL,
} from "@/data/contact";
import { HOLIS_WHATSAPP_NUMBER, HOLIS_WHATSAPP_URL } from "@/data/contact";

const WA_ME_RE = /^https:\/\/wa\.me\/(\d+)(?:\?.*)?$/i;

/**
 * Extract the phone number from a wa.me URL and compare it to the
 * canonical Holis number. Returns the canonical URL when the link
 * is missing, malformed, or points to a different number.
 */
export function validateWhatsAppLink(link: string | undefined | null): {
  url: string;
  valid: boolean;
  extractedNumber: string | null;
} {
  if (!link || typeof link !== "string") {
    return { url: HOLIS_WHATSAPP_URL, valid: false, extractedNumber: null };
  }

  const match = link.trim().match(WA_ME_RE);
  if (!match) {
    return { url: HOLIS_WHATSAPP_URL, valid: false, extractedNumber: null };
  }

  const extracted = match[1];
  const valid = extracted === HOLIS_WHATSAPP_NUMBER;
  return {
    url: valid ? link.trim() : HOLIS_WHATSAPP_URL,
    valid,
    extractedNumber: extracted,
  };
}

/**
 * Build a wa.me URL from a raw phone-number string.
 * Non-digit characters are stripped. Falls back to the canonical
 * number when the result is empty or doesn't match the canonical.
 */
export function buildWhatsAppUrl(rawNumber?: string): string {
  const digits = (rawNumber || "").replace(/\D/g, "");
  const number = digits === HOLIS_WHATSAPP_NUMBER ? digits : HOLIS_WHATSAPP_NUMBER;
  return `https://wa.me/${number}`;
}

/**
 * Format a raw phone number as a human-friendly Costa-Rica display.
 * Example: "50688146760" → "+506 8814 6760"
 */
export function formatWhatsAppDisplay(rawNumber: string = HOLIS_WHATSAPP_NUMBER): string {
  const digits = rawNumber.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("506")) {
    return `+506 ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  }
  return `+${digits}`;
}
