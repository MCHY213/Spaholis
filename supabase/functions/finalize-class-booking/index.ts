// deno-lint-ignore-file no-explicit-any
// Edge function: finalize-class-booking
//
// Class-booking counterpart of `finalize-booking` (which handles treatment
// `bookings`). Kept as a SEPARATE function on purpose so we never risk the live
// treatment payment path. It performs the same server-authoritative checks
// against the BAC CompraClick return payload — pending state, age, email,
// amount — but on `class_bookings`, and on success it also claims a class spot
// atomically (via the shared `decrement_class_spot` RPC) and sends the same
// confirmation email (via the shared `send-booking-notification` function).
//
// Never trust the browser's claimed status alone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PENDING_AGE_MS = 3 * 60 * 60 * 1000;

const REFERENCE_KEYS = ["reference", "order", "orderNumber", "orderId", "invoice", "ORDER_NUMBER"];
const AUTH_KEYS = ["authorization", "auth", "authCode", "AUTH_CODE"];
const AMOUNT_KEYS = ["amount", "AMOUNT", "total", "TOTAL"];

type Body = {
  bookingId?: string;
  guestEmail?: string;
  expectedAmount?: number;
  claimedStatus?: "approved" | "declined" | "cancelled" | "unknown";
  params?: Record<string, string>;
};

type Result =
  | { ok: true; status: "paid" | "failed" | "already_paid" | "already_failed" }
  | { ok: false; reason: string };

const pick = (params: Record<string, string> | undefined, keys: string[]): string | null => {
  if (!params) return null;
  for (const k of keys) {
    if (params[k]) return params[k];
  }
  return null;
};

async function logVerification(
  supabase: any,
  targetId: string | null,
  outcome: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_logs").insert({
      action: "bac_class_return_verification",
      target_type: "class_booking",
      target_id: targetId,
      result: outcome,
      details,
    });
  } catch (e) {
    console.error("[finalize-class-booking] audit insert failed", e);
  }
}

const respond = (result: Result, statusCode = 200) =>
  new Response(JSON.stringify(result), {
    status: statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export async function handleFinalizeClass(body: Body, supabase: any): Promise<{ result: Result; statusCode: number }> {
  const { bookingId, guestEmail, expectedAmount, claimedStatus, params } = body;

  const returnedAmountRaw = pick(params, AMOUNT_KEYS);
  const returnedAmount = returnedAmountRaw != null ? Number(returnedAmountRaw) : null;

  const audit = (fromStatus: string | null, toStatus: string | null, extra: Record<string, unknown> = {}) => ({
    claimed_status: claimedStatus ?? null,
    kind: "class",
    email: { provided: guestEmail ?? null, booking: extra.booking_email ?? null },
    amount: { expected: expectedAmount ?? null, returned: returnedAmount ?? null, returned_raw: returnedAmountRaw ?? null },
    transition: { from: fromStatus, to: toStatus },
    bac_params: params ?? {},
    ...extra,
  });

  if (!bookingId || !UUID_RE.test(bookingId)) {
    await logVerification(supabase, null, "invalid_booking_id", audit(null, null));
    return { result: { ok: false, reason: "invalid_booking_id" }, statusCode: 400 };
  }
  if (!claimedStatus || !["approved", "declined", "cancelled", "unknown"].includes(claimedStatus)) {
    await logVerification(supabase, bookingId, "invalid_claimed_status", audit(null, null));
    return { result: { ok: false, reason: "invalid_claimed_status" }, statusCode: 400 };
  }

  const { data: booking, error } = await supabase
    .from("class_bookings")
    .select("id, status, total_price, guest_email, created_at, schedule_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[finalize-class-booking] fetch error", error);
    await logVerification(supabase, bookingId, "fetch_failed", audit(null, null, { error: error.message }));
    return { result: { ok: false, reason: "fetch_failed" }, statusCode: 500 };
  }
  if (!booking) {
    await logVerification(supabase, bookingId, "not_found", audit(null, null));
    return { result: { ok: false, reason: "not_found" }, statusCode: 404 };
  }

  const fromStatus: string = booking.status;
  const bookingEmail: string | null = booking.guest_email ?? null;

  // Terminal states — idempotent. "confirmed"/"booked" == already paid.
  if (fromStatus === "confirmed" || fromStatus === "booked") {
    return { result: { ok: true, status: "already_paid" }, statusCode: 200 };
  }
  if (fromStatus === "payment_failed" || fromStatus === "cancelled") {
    return { result: { ok: true, status: "already_failed" }, statusCode: 200 };
  }
  if (fromStatus !== "pending_payment") {
    await logVerification(supabase, booking.id, "wrong_state", audit(fromStatus, null, { booking_email: bookingEmail }));
    return { result: { ok: false, reason: "wrong_state" }, statusCode: 409 };
  }

  const createdAt = booking.created_at ? new Date(booking.created_at).getTime() : 0;
  if (!createdAt || Date.now() - createdAt > MAX_PENDING_AGE_MS) {
    await logVerification(supabase, booking.id, "expired", audit(fromStatus, null, { booking_email: bookingEmail, created_at: booking.created_at }));
    return { result: { ok: false, reason: "expired" }, statusCode: 410 };
  }
  if (
    guestEmail && bookingEmail &&
    guestEmail.trim().toLowerCase() !== String(bookingEmail).trim().toLowerCase()
  ) {
    await logVerification(supabase, booking.id, "email_mismatch", audit(fromStatus, null, { booking_email: bookingEmail }));
    return { result: { ok: false, reason: "email_mismatch" }, statusCode: 403 };
  }
  if (returnedAmount != null && Number.isFinite(returnedAmount) && expectedAmount) {
    if (Math.abs(returnedAmount - expectedAmount) > 0.01) {
      await logVerification(supabase, booking.id, "amount_mismatch", audit(fromStatus, null, { booking_email: bookingEmail }));
      return { result: { ok: false, reason: "amount_mismatch" }, statusCode: 409 };
    }
  }

  if (claimedStatus === "approved") {
    const paymentId = pick(params, REFERENCE_KEYS) || pick(params, AUTH_KEYS) || `bac_return_${Date.now()}`;
    const { data: updated, error: updErr } = await supabase
      .from("class_bookings")
      .update({ status: "confirmed", payment_status: "paid", payment_id: paymentId })
      .eq("id", booking.id)
      .eq("status", "pending_payment")
      .select("id, schedule_id")
      .maybeSingle();
    if (updErr) {
      console.error("[finalize-class-booking] update error", updErr);
      await logVerification(supabase, booking.id, "update_failed", audit(fromStatus, null, { booking_email: bookingEmail, error: updErr.message }));
      return { result: { ok: false, reason: "update_failed" }, statusCode: 500 };
    }
    if (!updated) {
      // Race lost — the other invocation owns the spot + email.
      return { result: { ok: true, status: "already_paid" }, statusCode: 200 };
    }
    // We won the transition: claim a spot atomically, then email.
    try {
      await supabase.rpc("decrement_class_spot", { _schedule_id: booking.schedule_id });
    } catch (e) {
      console.error("[finalize-class-booking] spot decrement failed", (e as Error)?.message);
    }
    await logVerification(supabase, booking.id, "paid", audit(fromStatus, "confirmed", { booking_email: bookingEmail, payment_id: paymentId }));
    try {
      await supabase.functions.invoke("send-booking-notification", { body: { classBookingId: booking.id } });
    } catch (e) {
      console.error("[finalize-class-booking] notification invoke failed", e);
    }
    return { result: { ok: true, status: "paid" }, statusCode: 200 };
  }

  // declined | cancelled — no spot was held for a pending card booking, so
  // nothing to release; just mark it failed.
  await supabase
    .from("class_bookings")
    .update({ status: "payment_failed", payment_status: "failed" })
    .eq("id", booking.id)
    .eq("status", "pending_payment");
  await logVerification(supabase, booking.id, "payment_failed", audit(fromStatus, "payment_failed", { booking_email: bookingEmail, reason: claimedStatus }));
  return { result: { ok: true, status: "failed" }, statusCode: 200 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ ok: false, reason: "method_not_allowed" }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return respond({ ok: false, reason: "invalid_json" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { result, statusCode } = await handleFinalizeClass(body, supabase);
  return respond(result, statusCode);
});
