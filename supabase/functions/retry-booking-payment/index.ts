// deno-lint-ignore-file no-explicit-any
// Edge function: retry-booking-payment
//
// Customer-facing retry: given a payment_failed (or still pending_payment)
// booking + the guest's email, resets the booking to pending_payment and
// returns the correct BAC CompraClick link + deposit amount so the browser
// can redirect the user back to the hosted checkout.
//
// Guardrails:
//   - The booking must be in `payment_failed` or `pending_payment`.
//   - The guest_email must match (case-insensitive).
//   - The booking must be within RETRY_WINDOW_MS of creation, so we don't
//     revive appointments whose time slot has already come and gone.
//   - Every retry is written to audit_logs for traceability.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h from booking creation

const BAC_LINK_10 = "https://checkout.baccredomatic.com/YTNjNzIuYjY4Mzk0MjY3NzFjMTgwNjQxNzgzMDIwNjE2";
const BAC_LINK_20 = "https://checkout.baccredomatic.com/Ni42NjExMGM0NTQxYTcwYjYxNzA2MTkxNzgzMDIwNjQw";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isFacial(service: { title?: string | null; category?: string | null } | null): boolean {
  if (!service) return false;
  const title = (service.title || "").toLowerCase();
  const category = (service.category || "").toLowerCase();
  return category.includes("facial") || title.includes("facial") || title.includes("cosmolifting");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let body: { bookingId?: string; guestEmail?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const { bookingId, guestEmail } = body;
  if (!bookingId || !UUID_RE.test(bookingId)) return json({ ok: false, reason: "invalid_booking_id" }, 400);
  if (!guestEmail) return json({ ok: false, reason: "email_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, status, guest_email, created_at, service_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) return json({ ok: false, reason: "fetch_failed" }, 500);
  if (!booking) return json({ ok: false, reason: "not_found" }, 404);

  if (guestEmail.trim().toLowerCase() !== String(booking.guest_email || "").trim().toLowerCase()) {
    return json({ ok: false, reason: "email_mismatch" }, 403);
  }

  if (booking.status === "paid") return json({ ok: false, reason: "already_paid" }, 409);
  if (!["payment_failed", "pending_payment"].includes(booking.status)) {
    return json({ ok: false, reason: "wrong_state" }, 409);
  }

  const created = booking.created_at ? new Date(booking.created_at).getTime() : 0;
  if (!created || Date.now() - created > RETRY_WINDOW_MS) {
    return json({ ok: false, reason: "retry_window_expired" }, 410);
  }

  // Look up service to pick the right BAC link / amount.
  let service: any = null;
  if (booking.service_id) {
    const { data } = await supabase
      .from("services")
      .select("title, category")
      .eq("id", booking.service_id)
      .maybeSingle();
    service = data;
  }

  const facial = isFacial(service);
  const amount = facial ? 10 : 20;
  const link = facial ? BAC_LINK_10 : BAC_LINK_20;

  // Reset to pending_payment so /booking/return can transition on the next callback.
  await supabase
    .from("bookings")
    .update({ status: "pending_payment" })
    .eq("id", booking.id)
    .in("status", ["payment_failed", "pending_payment"]);

  await supabase.from("audit_logs").insert({
    action: "booking.customer_retry",
    target_id: booking.id,
    result: "reset_to_pending_payment",
    details: { previous_status: booking.status, amount, service_title: service?.title ?? null },
  });

  return json({ ok: true, bacLink: link, amount, serviceTitle: service?.title ?? null });
});
