/**
 * ════════════════════════════════════════════════════════════════════
 *  CARD AUTHORIZATION — ARCHIVED / INTERNAL ONLY
 *  This page preserves the legacy Card Authorization form for future
 *  internal use. It is intentionally NOT linked from the public site
 *  nor from the admin sidebar — access only via the direct URL
 *  `/admin/card-authorization-archive`. Requires super_admin/manager.
 *
 *  The component, validation, styling, and authorization copy mirror
 *  what used to appear in the customer booking flow. Do not delete.
 * ════════════════════════════════════════════════════════════════════
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, Archive } from "lucide-react";

const NAME_RE = /^[\p{L}][\p{L}\s'\-.]{1,}$/u;
const formatName = (v: string) => v.replace(/[^\p{L}\s'\-.]/gu, "").slice(0, 100);
const formatCardNumber = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const cardDigits = (v: string) => v.replace(/\D/g, "");

export default function CardAuthorizationArchive() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [cardAuth, setCardAuth] = useState({
    cardholder_name: "",
    card_number: "",
    card_expiry: "",
    card_cvv: "",
    card_type: "",
    authorized: false,
    signature_acknowledgment: false,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .then(({ data }) => {
          const roles = (data ?? []).map((r) => r.role);
          setIsAdmin(roles.includes("super_admin") || roles.includes("manager"));
        });
    }
  }, [user, loading, navigate]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <ShieldAlert className="h-16 w-16 text-destructive/60" />
        <h1 className="font-heading text-2xl text-foreground">Access Denied</h1>
        <p className="font-body text-muted-foreground text-center max-w-md">
          This archive is only available to administrators.
        </p>
        <Button variant="default" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const digits = cardDigits(cardAuth.card_number);
  const isValid =
    NAME_RE.test(cardAuth.cardholder_name.trim()) &&
    digits.length >= 13 &&
    digits.length <= 19 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(cardAuth.card_expiry) &&
    cardAuth.card_cvv.length >= 3 &&
    cardAuth.authorized &&
    cardAuth.signature_acknowledgment;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Card Authorization Archive · Internal"
        description="Internal archive of the legacy card authorization form."
        canonical="/admin/card-authorization-archive"
      />
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="flex items-center gap-3 mb-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider font-body text-muted-foreground">
            Internal · Archived feature
          </span>
        </div>
        <h1 className="font-heading text-3xl text-foreground mb-2">
          Card Authorization Form (Archive)
        </h1>
        <p className="font-body text-sm text-muted-foreground mb-8 leading-relaxed">
          This form has been removed from the public booking flow. It is preserved
          here for future internal use. Submissions on this page are not stored.
        </p>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="h-6 w-6 text-spa-sage" />
            <h2 className="spa-heading-md text-foreground">
              {t("booking.cardAuth.title", { defaultValue: "Card Authorization" })}
            </h2>
          </div>
          <p className="spa-body-sm mb-6">
            {t("booking.cardAuth.subtitle", {
              defaultValue:
                "We use your card details only to guarantee your reservation.",
            })}
          </p>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">
                {t("booking.cardAuth.cardholder", { defaultValue: "Cardholder name" })}
              </label>
              <Input
                value={cardAuth.cardholder_name}
                onChange={(e) =>
                  setCardAuth({ ...cardAuth, cardholder_name: formatName(e.target.value) })
                }
                placeholder={t("booking.cardAuth.cardholderPlaceholder", {
                  defaultValue: "Name on card",
                })}
                autoComplete="cc-name"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">
                {t("booking.cardAuth.cardNumber", { defaultValue: "Card number" })}
              </label>
              <Input
                value={cardAuth.card_number}
                onChange={(e) =>
                  setCardAuth({ ...cardAuth, card_number: formatCardNumber(e.target.value) })
                }
                placeholder="1234 5678 9012 3456"
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={23}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">
                  {t("booking.cardAuth.expiry", { defaultValue: "Expiry" })}
                </label>
                <Input
                  value={cardAuth.card_expiry}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^\d/]/g, "");
                    if (val.length === 2 && !val.includes("/") && cardAuth.card_expiry.length < val.length) val += "/";
                    setCardAuth({ ...cardAuth, card_expiry: val.slice(0, 5) });
                  }}
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">
                  {t("booking.cardAuth.cvv", { defaultValue: "CVV" })}
                </label>
                <Input
                  value={cardAuth.card_cvv}
                  onChange={(e) =>
                    setCardAuth({
                      ...cardAuth,
                      card_cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                  placeholder="123"
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">
                {t("booking.cardAuth.cardType", { defaultValue: "Card type" })}
              </label>
              <div className="flex flex-wrap gap-2">
                {["Visa", "Mastercard", "Amex", "Other"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCardAuth({ ...cardAuth, card_type: type })}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-body font-medium border transition-all",
                      cardAuth.card_type === type
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:border-muted-foreground/50",
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 mt-4 space-y-4">
              <p className="font-body text-sm text-foreground font-medium">
                {t("booking.cardAuth.declaration", { defaultValue: "Authorization declaration" })}
              </p>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                {t("booking.cardAuth.declarationText", {
                  defaultValue:
                    "I authorize Holis Wellness Center to charge the card above for the agreed amount.",
                })}
              </p>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="archive-authorize"
                  checked={cardAuth.authorized}
                  onCheckedChange={(checked) =>
                    setCardAuth({ ...cardAuth, authorized: !!checked })
                  }
                />
                <label htmlFor="archive-authorize" className="font-body text-sm text-foreground">
                  {t("booking.cardAuth.authorizeLabel", {
                    defaultValue: "I authorize the charge.",
                  })}
                </label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="archive-signature"
                  checked={cardAuth.signature_acknowledgment}
                  onCheckedChange={(checked) =>
                    setCardAuth({ ...cardAuth, signature_acknowledgment: !!checked })
                  }
                />
                <label htmlFor="archive-signature" className="font-body text-sm text-foreground">
                  {t("booking.cardAuth.signatureLabel", {
                    defaultValue: "This acknowledgment serves as my electronic signature.",
                  })}
                </label>
              </div>
            </div>

            <div className="pt-2">
              <p
                className={cn(
                  "text-xs font-body",
                  isValid ? "text-spa-sage" : "text-muted-foreground",
                )}
              >
                {isValid ? "Form valid (preview only — nothing is submitted)." : "Fill all fields to preview validation."}
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
