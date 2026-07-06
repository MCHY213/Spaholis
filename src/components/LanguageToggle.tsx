import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTranslation } from "react-i18next";

const LABELS: Record<"en" | "es", string> = { en: "English", es: "Español" };

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("common.language")}
          className="gap-1.5 px-2 text-xs font-body font-medium"
        >
          <Languages className="h-4 w-4" />
          {!compact && <span className="uppercase">{language}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {(["en", "es"] as const).map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLanguage(code)}
            className={language === code ? "font-semibold text-foreground" : ""}
          >
            <span className="uppercase mr-2 text-xs text-muted-foreground">{code}</span>
            {LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
