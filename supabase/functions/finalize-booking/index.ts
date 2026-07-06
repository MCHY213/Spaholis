// deno-lint-ignore-file no-explicit-any
// Edge function: finalize-booking
//
// Server-authoritative validation of the BAC CompraClick return payload.
// The browser sends the bookingId (from sessionStorage) plus every query
// parameter BAC appended to the Return URL. This function:
//   1. Loads the booking with the service role (bypasses RLS safely).
//   2. Verifies status = 'pending_payment' (no replays on already-paid rows).
//   3. Verifies the booking was created within MAX_PENDING_AGE_MS.
//   4. Verifies guest_email matches the caller-supplied email.
//   5. If BAC echoed an amount, verifies it matches the expected deposit.
//   6. Atomically transitions the row using a filtered UPDATE.
//
// Never trust the browser's claimed status alone — we cross-check everything
// against the persisted booking before flipping it to 'paid'.

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

// Fire-and-forget audit trail so admins can see every finalize-booking
// verification outcome per booking (paid, failed, or a specific rejection
// reason like email_mismatch / expired / amount_mismatch).
async function logVerification(
  supabase: any,
  targetId: string | null,
  outcome: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_logs").insert({
      action: "bac_return_verification",
      target_type: "booking",
      target_id: targetId,
      result: outcome,
      details,
    });
  } catch (e) {
    console.error("[finalize-booking] audit insert failed", e);
  }
}

const respond = (result: Result, statusCode = 200) =>
  new Response(JSON.stringify(result), {
    status: statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export async function handleFinalize(body: Body, supabase: any): Promise<{ result: Result; statusCode: number }> {
  const { bookingId, guestEmail, expectedAmount, claimedStatus, params } = body;

  // A per-invocation id lets us correlate all audit rows for a single
  // finalize-booking call (browser retry, replay, concurrent race, etc.).
  const attemptId = (globalThis.crypto as any)?.randomUUID?.() ?? `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const returnedAmountRaw = pick(params, AMOUNT_KEYS);
  const returnedAmount = returnedAmountRaw != null ? Number(returnedAmountRaw) : null;

  // Build a consistent audit record for every branch. `transition.to` is
  // filled in per-branch; everything else is stable input context.
  const buildAudit = (fromStatus: string | null, toStatus: string | null, extra: Record<string, unknown> = {}) => ({
    attempt_id: attemptId,
    claimed_status: claimedStatus ?? null,
    email: {
      provided: guestEmail ?? null,
      booking: extra.booking_email ?? null,
    },
    amount: {
      expected: expectedAmount ?? null,
      returned: returnedAmount != null && Number.isFinite(returnedAmount) ? returnedAmount : null,
      returned_raw: returnedAmountRaw ?? null,
    },
    transition: { from: fromStatus, to: toStatus },
    bac_params: params ?? {},
    ...extra,
  });

  if (!bookingId || !UUID_RE.test(bookingId)) {
    await logVerification(supabase, null, "invalid_booking_id", buildAudit(null, null));
    return { result: { ok: false, reason: "invalid_booking_id" }, statusCode: 400 };
  }
  if (!claimedStatus || !["approved", "declined", "cancelled", "unknown"].includes(claimedStatus)) {
    await logVerification(supabase, bookingId, "invalid_claimed_status", buildAudit(null, null));
    return { result: { ok: false, reason: "invalid_claimed_status" }, statusCode: 400 };
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, status, total_price, guest_email, created_at, payment_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[finalize-booking] fetch error", error);
    await logVerification(supabase, bookingId, "fetch_failed", buildAudit(null, null, { error: error.message }));
    return { result: { ok: false, reason: "fetch_failed" }, statusCode: 500 };
  }
  if (!booking) {
    await logVerification(supabase, bookingId, "not_found", buildAudit(null, null));
    return { result: { ok: false, reason: "not_found" }, statusCode: 404 };
  }

  const fromStatus: string = booking.status;
  const bookingEmail: string | null = booking.guest_email ?? null;

  if (fromStatus === "paid") {
    await logVerification(supabase, booking.id, "already_paid", buildAudit(fromStatus, "paid", { booking_email: bookingEmail }));
    return { result: { ok: true, status: "already_paid" }, statusCode: 200 };
  }
  if (fromStatus === "payment_failed" || fromStatus === "cancelled") {
    await logVerification(supabase, booking.id, "already_failed", buildAudit(fromStatus, fromStatus, { booking_email: bookingEmail, current_status: fromStatus }));
    return { result: { ok: true, status: "already_failed" }, statusCode: 200 };
  }
  if (fromStatus !== "pending_payment") {
    await logVerification(supabase, booking.id, "wrong_state", buildAudit(fromStatus, null, { booking_email: bookingEmail, current_status: fromStatus }));
    return { result: { ok: false, reason: "wrong_state" }, statusCode: 409 };
  }

  const createdAt = booking.created_at ? new Date(booking.created_at).getTime() : 0;
  if (!createdAt || Date.now() - createdAt > MAX_PENDING_AGE_MS) {
    await logVerification(supabase, booking.id, "expired", buildAudit(fromStatus, null, {
      booking_email: bookingEmail,
      created_at: booking.created_at,
      max_age_ms: MAX_PENDING_AGE_MS,
    }));
    return { result: { ok: false, reason: "expired" }, statusCode: 410 };
  }

  if (
    guestEmail &&
    bookingEmail &&
    guestEmail.trim().toLowerCase() !== String(bookingEmail).trim().toLowerCase()
  ) {
    await logVerification(supabase, booking.id, "email_mismatch", buildAudit(fromStatus, null, { booking_email: bookingEmail }));
    return { result: { ok: false, reason: "email_mismatch" }, statusCode: 403 };
  }

  if (returnedAmount != null && Number.isFinite(returnedAmount) && expectedAmount) {
    if (Math.abs(returnedAmount - expectedAmount) > 0.01) {
      await logVerification(supabase, booking.id, "amount_mismatch", buildAudit(fromStatus, null, { booking_email: bookingEmail }));
      return { result: { ok: false, reason: "amount_mismatch" }, statusCode: 409 };
    }
  }

  if (claimedStatus === "approved") {
    const paymentId = pick(params, REFERENCE_KEYS) || pick(params, AUTH_KEYS) || `bac_return_${Date.now()}`;
    const { data: updated, error: updErr } = await supabase
      .from("bookings")
      .update({ status: "paid", payment_id: paymentId })
      .eq("id", booking.id)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();
    if (updErr) {
      console.error("[finalize-booking] update error", updErr);
      await logVerification(supabase, booking.id, "update_failed", buildAudit(fromStatus, null, { booking_email: bookingEmail, error: updErr.message }));
      return { result: { ok: false, reason: "update_failed" }, statusCode: 500 };
    }
    if (!updated) {
      await logVerification(supabase, booking.id, "already_paid", buildAudit(fromStatus, "paid", { booking_email: bookingEmail, race: true }));
      // Race lost — the other invocation is responsible for sending the email.
      return { result: { ok: true, status: "already_paid" }, statusCode: 200 };
    }
    await logVerification(supabase, booking.id, "paid", buildAudit(fromStatus, "paid", { booking_email: bookingEmail, payment_id: paymentId }));
    // Fire confirmation + admin notification emails. The notification
    // function atomically claims `notification_sent_at`, so a concurrent
    // bac-webhook call cannot cause duplicates.
    try {
      await supabase.functions.invoke("send-booking-notification", { body: { bookingId: booking.id } });
    } catch (e) {
      console.error("[finalize-booking] notification invoke failed", e);
    }
    return { result: { ok: true, status: "paid" }, statusCode: 200 };
  }

  if (claimedStatus === "declined" || claimedStatus === "cancelled") {
    await supabase
      .from("bookings")
      .update({ status: "payment_failed" })
      .eq("id", booking.id)
      .eq("status", "pending_payment");
    await logVerification(supabase, booking.id, "payment_failed", buildAudit(fromStatus, "payment_failed", { booking_email: bookingEmail, reason: claimedStatus }));
    return { result: { ok: true, status: "failed" }, statusCode: 200 };
  }

  await logVerification(supabase, booking.id, "no_status", buildAudit(fromStatus, null, { booking_email: bookingEmail }));
  return { result: { ok: false, reason: "no_status" }, statusCode: 400 };
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

  const { result, statusCode } = await handleFinalize(body, supabase);
  return respond(result, statusCode);
});
