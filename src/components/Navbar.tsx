import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useSiteContent } from "@/hooks/useSiteContent";
import { content as defaults } from "@/data/content";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage, withLangPrefix } from "@/i18n/LanguageProvider";
import holisLogo from "@/assets/holis-logo-clean.png";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: siteContent } = useSiteContent();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const firstLink = drawerRef.current?.querySelector<HTMLElement>("a, button");
      firstLink?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  const nav = siteContent?.nav || defaults.nav;

  // Translation keys for known nav destinations — falls back to admin-edited label otherwise.
  const NAV_KEYS: Record<string, string> = {
    "/": "nav.home",
    "/about": "nav.about",
    "/treatments-therapies": "nav.treatments",
    "/classes": "nav.classes",
    "/retreats": "nav.retreats",
    "/blog": "nav.blog",
    "/faqs": "nav.faqs",
    "/gift-cards": "nav.giftCards",
    "/book": "nav.book",
  };
  const labelFor = (link: { label: string; to: string }) =>
    NAV_KEYS[link.to] ? t(NAV_KEYS[link.to]) : link.label;
  const lp = (path: string) => withLangPrefix(path, language);

  let navLinks: { label: string; to: string }[] = [...nav.links];
  if (!navLinks.some((link) => link.to === "/blog")) {
    navLinks = [...navLinks, { label: "Blog", to: "/blog" }];
  }
  if (!navLinks.some((link) => link.to === "/faqs")) {
    navLinks = [...navLinks, { label: "FAQs", to: "/faqs" }];
  }
  if (!navLinks.some((link) => link.to === "/education")) {
    navLinks = [...navLinks, { label: "Education", to: "/education" }];
  }

  const isActive = (to: string) =>
    location.pathname === lp(to) || location.pathname === to;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to={lp("/")} className="flex items-center gap-2">
          <img src={holisLogo} alt="Holis Wellness Center" className="h-14 w-auto" />
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={lp(link.to)}
              className={`text-sm font-body font-medium transition-colors hover:text-foreground ${
                isActive(link.to) ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {labelFor(link)}
            </Link>
          ))}
          <LanguageToggle />
          {user ? (
            <div className="flex items-center gap-3">
              <Link to={lp("/dashboard")} className="text-sm font-body font-medium text-muted-foreground hover:text-foreground">
                {t("nav.myAccount", { defaultValue: nav.myAccountLabel })}
              </Link>
              <Button variant="ghost" size="sm" onClick={() => signOut()} aria-label={t("nav.signOut")}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link to={lp("/auth")}>{t("nav.signIn", { defaultValue: nav.signInLabel })}</Link>
            </Button>
          )}
        </div>

        {/* Mobile */}
        <div className="lg:hidden flex items-center gap-1">
          <LanguageToggle compact />
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-drawer"
            aria-haspopup="dialog"
            aria-label={open ? t("nav.closeMenu", { defaultValue: "Close menu" }) : t("nav.openMenu", { defaultValue: "Open menu" })}
            className="inline-flex items-center justify-center rounded-md h-9 w-9 min-h-11 min-w-11 text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={drawerRef}
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.mobileNavigation", { defaultValue: "Mobile navigation" })}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-background border-b border-border max-h-[85vh] overflow-y-auto"
          >
            <nav aria-label={t("nav.mobileNavigation", { defaultValue: "Mobile" })} className="px-4 py-4">
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={lp(link.to)}
                      onClick={() => setOpen(false)}
                      className="block text-sm font-body font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
                    >
                      {labelFor(link)}
                    </Link>
                  </li>
                ))}
                {user ? (
                  <>
                    <li>
                      <Link to={lp("/dashboard")} onClick={() => setOpen(false)} className="block text-sm font-body font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded">{t("nav.myAccount", { defaultValue: nav.myAccountLabel })}</Link>
                    </li>
                    <li>
                      <Button variant="ghost" size="sm" className="w-full justify-start px-0 font-body font-medium" onClick={() => { signOut(); setOpen(false); }}>{t("nav.signOut", { defaultValue: nav.signOutLabel })}</Button>
                    </li>
                  </>
                ) : (
                  <li>
                    <Button variant="default" size="sm" className="w-full" asChild>
                      <Link to={lp("/auth")} onClick={() => setOpen(false)}>{t("nav.signIn", { defaultValue: nav.signInLabel })}</Link>
                    </Button>
                  </li>
                )}
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
