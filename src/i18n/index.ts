import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

export type Language = "en" | "es";
export const SUPPORTED_LANGUAGES: Language[] = ["en", "es"];
export const DEFAULT_LANGUAGE: Language = "en";
const STORAGE_KEY = "holis_lang";

export function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  // 1. URL prefix wins
  if (window.location.pathname.startsWith("/es/") || window.location.pathname === "/es") {
    return "es";
  }
  // 2. Cookie/localStorage
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

export function persistLanguage(lang: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.cookie = `${STORAGE_KEY}=${lang};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: readStoredLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
