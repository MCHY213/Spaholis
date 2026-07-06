import { Button } from "@/components/ui/button";
import { MessageCircle, Mail } from "lucide-react";
import { HOLIS_WHATSAPP_NUMBER, buildWhatsAppUrl } from "@/lib/whatsapp";

interface ContactToPayNoticeProps {
  serviceTitle: string;
  amount: number;
  contactEmail?: string;
  whatsappNumber?: string;
}

/**
 * Placeholder payment surface shown where an online card checkout used to live.
 * The website's live payment method is BAC CompraClick (fixed-amount deposit
 * links used by the treatments booking flow). For arbitrary-amount purchases
 * (classes, offerings, gift cards) customers are asked to contact the team.
 */
export function ContactToPayNotice({
  serviceTitle,
  amount,
  contactEmail = "spaholisma@gmail.com",
  whatsappNumber = HOLIS_WHATSAPP_NUMBER,
}: ContactToPayNoticeProps) {
  // `amount` is USD (matches services.price / classes.price in the DB
  // after the CRC → USD reversion). Format with two decimals for clarity.
  const displayAmount = `$${(Number(amount) || 0).toFixed(2)}`;
  const subject = encodeURIComponent(`Purchase request: ${serviceTitle}`);
  const body = encodeURIComponent(
    `Hi, I'd like to complete this purchase:\n\nItem: ${serviceTitle}\nAmount: ${displayAmount}\n\nPlease send me a payment link. Thank you!`,
  );
  const waMsg = encodeURIComponent(
    `Hi Holis! I'd like to purchase "${serviceTitle}" (${displayAmount}). Could you send me a payment link?`,
  );

  const waUrl = buildWhatsAppUrl(whatsappNumber);
  if (whatsappNumber !== HOLIS_WHATSAPP_NUMBER && typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      `[WhatsApp] ContactToPayNotice number "${whatsappNumber}" does not match canonical. Using canonical link.`
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
          Complete your purchase
        </h3>
        <p className="font-body text-sm text-muted-foreground">
          Contact our team to receive a secure payment link for this item.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild className="flex-1">
          <a
            href={`${waUrl}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href={`mailto:${contactEmail}?subject=${subject}&body=${body}`}>
            <Mail className="h-4 w-4 mr-2" />
            Email us
          </a>
        </Button>
      </div>
    </div>
  );
}
