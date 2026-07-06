// deno-lint-ignore-file no-explicit-any
// Edge function: bac-webhook
//
// Public endpoint (verify_jwt = false) intended for BAC CompraClick
// server-to-server notifications. CompraClick's default hosted checkout
// relies on the browser Return URL, but merchants can request a
// notification URL from BAC support. Point that URL here.
//
// Expected payload shape (accepts common variants):
//   {
//     "bookingId": "<uuid>",           // required — our reference sent to BAC
//     "status": "approved"|"declined"|"cancelled",
//     "reference": "...",              // BAC order/auth reference (optional)
//     "authorization": "...",          // BAC auth code (optional)
//     "amount": 20                      // echoed deposit amount (optional)
//   }
//
// Security: BAC does not sign this payload by default. Set the
// BAC_WEBHOOK_SECRET environment variable and configure BAC to send the
// same value in the `x-bac-secret` header (or `secret` body field). We
// reject calls that don't match. This is a shared-secret model — rotate
// via the secrets tooling.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bac-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  // Shared-secret check (only enforced if the secret has been configured).
  const expectedSecret = Deno.env.get("BAC_WEBHOOK_SECRET");
  if (expectedSecret) {
    const providedSecret = req.headers.get("x-bac-secret") || body.secret;
    if (providedSecret !== expectedSecret) {
      console.warn("[bac-webhook] rejected: bad secret");
      return json({ ok: false, reason: "unauthorized" }, 401);
    }
  }

  const bookingId: string | undefined = body.bookingId || body.booking_id || body.reference || body.ORDER_NUMBER;
  const rawStatus = String(body.status || body.result || body.RESPONSE || "").toLowerCase();
  const status: "approved" | "declined" | "cancelled" | "unknown" =
    rawStatus.includes("approve") || rawStatus === "success" || rawStatus === "ok" || rawStatus === "00"
      ? "approved"
      : rawStatus.includes("declin") || rawStatus === "failed"
        ? "declined"
        : rawStatus.includes("cancel")
          ? "cancelled"
          : "unknown";

  if (!bookingId || !UUID_RE.test(bookingId)) {
    return json({ ok: false, reason: "invalid_booking_id" }, 400);
  }
  if (status === "unknown") {
    return json({ ok: false, reason: "invalid_status" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, status, total_price")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) return json({ ok: false, reason: "fetch_failed" }, 500);
  if (!booking) return json({ ok: false, reason: "not_found" }, 404);

  // Idempotent — never overwrite a terminal state.
  if (booking.status === "paid") return json({ ok: true, status: "already_paid" });
  if (booking.status === "payment_failed" || booking.status === "cancelled") {
    return json({ ok: true, status: "already_failed" });
  }
  if (booking.status !== "pending_payment") {
    return json({ ok: false, reason: "wrong_state" }, 409);
  }

  if (status === "approved") {
    const paymentId = body.reference || body.authorization || body.authCode || `bac_webhook_${Date.now()}`;
    const { data: updated } = await supabase
      .from("bookings")
      .update({ status: "paid", payment_id: paymentId })
      .eq("id", booking.id)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    await supabase.from("audit_logs").insert({
      action: "booking.bac_webhook",
      target_id: booking.id,
      result: updated ? "paid" : "race_already_transitioned",
      details: { reference: body.reference, amount: body.amount },
    });

    // Trigger emails only on the winning transition; the notification
    // function itself is idempotent via `notification_sent_at`, so this
    // is safe even if the browser return callback also fires it.
    if (updated) {
      try {
        await supabase.functions.invoke("send-booking-notification", { body: { bookingId: booking.id } });
      } catch (e) {
        console.error("[bac-webhook] notification invoke failed", e);
      }
    }

    return json({ ok: true, status: updated ? "paid" : "already_paid" });
  }

  // declined | cancelled
  await supabase
    .from("bookings")
    .update({ status: "payment_failed" })
    .eq("id", booking.id)
    .eq("status", "pending_payment");

  await supabase.from("audit_logs").insert({
    action: "booking.bac_webhook",
    target_id: booking.id,
    result: "payment_failed",
    details: { reason: status },
  });

  return json({ ok: true, status: "failed" });
});
