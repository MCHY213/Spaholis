// Gift card checkout — payment-provider-agnostic layer.
//
// This module keeps the gift card record creation separate from the payment
// provider. Adding a new provider (PayPal, Stripe, etc.) means implementing
// the `GiftCardPaymentProvider` interface and registering it below — no
// changes to the UI or the DB write path are required.

import { supabase } from "@/integrations/supabase/client";

export interface GiftCardPurchaseInput {
  amount: number;
  purchaserEmail: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
}

export interface CreatedGiftCard {
  id: string;
  code: string;
  amount: number;
}

/**
 * Result returned by a provider after it has taken (or arranged for) payment.
 * `paymentId` is stored on the gift_cards row for reconciliation.
 * `status` tells the checkout flow what to do next.
 */
export interface PaymentResult {
  paymentId: string;
  status: "paid" | "pending";
  providerRef?: Record<string, unknown>;
}

export interface GiftCardPaymentProvider {
  id: "manual" | "paypal" | "stripe";
  label: string;
  /**
   * Ask the provider to collect payment for `input.amount`. Providers that
   * redirect (PayPal) resolve after the user returns; providers that defer
   * (manual contact) resolve immediately with status `pending`.
   */
  pay(input: GiftCardPurchaseInput): Promise<PaymentResult>;
}

// ---------- Code generation & DB write ----------

export function generateGiftCardCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "HOLIS-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Insert the gift_cards row. Called by the checkout flow after a provider
 * confirms (or defers) payment. Provider-agnostic on purpose — same shape
 * regardless of payment rail.
 */
export async function createGiftCardRecord(
  input: GiftCardPurchaseInput,
  payment: PaymentResult,
): Promise<CreatedGiftCard> {
  const code = generateGiftCardCode();
  const { data, error } = await supabase
    .from("gift_cards")
    .insert({
      code,
      initial_value: input.amount,
      remaining_value: input.amount,
      purchaser_email: input.purchaserEmail,
      recipient_email: input.recipientEmail || null,
      recipient_name: input.recipientName || null,
      message: input.message || null,
      payment_id: payment.paymentId,
      is_active: payment.status === "paid",
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    } as any)
    .select("id, code, initial_value")
    .single();

  if (error) throw error;
  return { id: data.id as string, code: data.code as string, amount: Number(data.initial_value) };
}

// ---------- Providers ----------

/**
 * Manual provider — customer contacts the team (WhatsApp / email) to receive
 * a payment link. No record is created here; the UI shows contact CTAs and
 * the team creates the gift card from the admin panel after payment.
 */
export const manualProvider: GiftCardPaymentProvider = {
  id: "manual",
  label: "Contact to pay",
  async pay() {
    // Intentionally does not create a record — see comment above.
    return { paymentId: "manual", status: "pending" };
  },
};

/**
 * PayPal provider — stub. Wire this to `paypal-create-order` /
 * `paypal-capture-order` edge functions when enabling PayPal for gift cards.
 *
 * Suggested implementation:
 *   1. Call a new `paypal-create-giftcard-order` edge function with the
 *      purchase input; it validates the amount and returns { orderId }.
 *   2. Render the PayPal JS SDK buttons; on approve call
 *      `paypal-capture-giftcard-order` which creates the gift_cards row
 *      server-side and returns { paymentId, code }.
 *   3. Resolve with { paymentId, status: "paid" }.
 */
export const paypalProvider: GiftCardPaymentProvider = {
  id: "paypal",
  label: "PayPal",
  async pay(_input) {
    throw new Error("PayPal gift card checkout is not enabled yet.");
  },
};

export const giftCardProviders: Record<GiftCardPaymentProvider["id"], GiftCardPaymentProvider> = {
  manual: manualProvider,
  paypal: paypalProvider,
  stripe: {
    id: "stripe",
    label: "Stripe",
    async pay() {
      throw new Error("Stripe gift card checkout is not enabled.");
    },
  },
};

/** The active provider — swap when PayPal is ready. */
export function getActiveGiftCardProvider(): GiftCardPaymentProvider {
  return manualProvider;
}
