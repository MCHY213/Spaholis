import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import i18n, { DEFAULT_LANGUAGE, persistLanguage, readStoredLanguage, type Language } from "./index";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

/** Strip a leading /es prefix from a pathname. Returns the English path. */
export function stripLangPrefix(pathname: string): string {
  if (pathname === "/es") return "/";
  if (pathname.startsWith("/es/")) return pathname.slice(3) || "/";
  return pathname;
}

/** Build the path for a given language from any path. */
export function withLangPrefix(pathname: string, lang: Language): string {
  const base = stripLangPrefix(pathname);
  if (lang === "es") {
    return base === "/" ? "/es" : `/es${base}`;
  }
  return base;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  // Sync language to URL prefix on mount + on path change
  useEffect(() => {
    const fromUrl: Language =
      location.pathname === "/es" || location.pathname.startsWith("/es/") ? "es" : "en";
    if (fromUrl !== language) {
      setLanguageState(fromUrl);
      i18n.changeLanguage(fromUrl);
      persistLanguage(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      i18n.changeLanguage(lang);
      persistLanguage(lang);
      const next = withLangPrefix(location.pathname, lang) + location.search + location.hash;
      navigate(next, { replace: false });
    },
    [location.pathname, location.search, location.hash, navigate]
  );

  // Keep <html lang> in sync
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
