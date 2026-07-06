// deno-lint-ignore-file no-explicit-any
// Edge function: paypal-capture-order
//
// Captures a PayPal order created by paypal-create-order and finalizes the
// matching studio-class booking.
//
// Flow:
//  1. Look up the PENDING class_bookings row by paypal_order_id.
//  2. Call PayPal /v2/checkout/orders/{id}/capture.
//  3. On COMPLETED: mark booking `status='booked'`, `payment_status='paid'`,
//     `payment_id` = PayPal capture id, then trigger the booking notification.
//  4. On failure: mark booking `status='cancelled'`, `payment_status='failed'`
//     so the seat is released and reconciliation is easy.
//
// The frontend calls this immediately after the PayPal JS SDK reports the
// buyer approved the order. We NEVER trust the client to say "paid" —
// PayPal's capture response is the source of truth.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.25.76";
import { getPayPalAccessToken, paypalFetch } from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  orderId: z.string().trim().min(4).max(64),
});

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractCaptureId(captureBody: any): string | null {
  try {
    const pu = captureBody?.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    return cap?.id ? String(cap.id) : null;
  } catch {
    return null;
  }
}

function extractCaptureStatus(captureBody: any): string | null {
  try {
    const pu = captureBody?.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    return cap?.status ? String(cap.status) : (captureBody?.status ? String(captureBody.status) : null);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }
  if (!parsed.success) {
    return json({ ok: false, reason: "invalid_body", errors: parsed.error.flatten().fieldErrors }, 400);
  }
  const { orderId } = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Locate the pending booking for this PayPal order.
    const { data: booking, error: bookingErr } = await admin
      .from("class_bookings")
      .select("id, payment_status, status, paypal_order_id, payment_id, schedule_id, guest_email")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!booking) return json({ ok: false, reason: "booking_not_found" }, 404);

    // Idempotency: if already paid, return success with the stored capture id.
    if (booking.payment_status === "paid" && booking.payment_id) {
      return json({
        ok: true,
        bookingId: booking.id,
        captureId: booking.payment_id,
        alreadyCaptured: true,
      });
    }

    // 2. Capture the order at PayPal.
    const accessToken = await getPayPalAccessToken();
    const captureRes = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      accessToken,
      // Body must be empty (or {}) for capture.
      body: JSON.stringify({}),
    });

    const captureStatus = extractCaptureStatus(captureRes.body);
    const captureId = extractCaptureId(captureRes.body);
    const success =
      captureRes.status >= 200 &&
      captureRes.status < 300 &&
      captureStatus === "COMPLETED" &&
      !!captureId;

    if (!success) {
      // Mark booking as failed so the seat is released.
      await admin
        .from("class_bookings")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", booking.id);

      console.error("[paypal-capture-order] capture failed", {
        orderId,
        status: captureRes.status,
        capture_status: captureStatus,
        raw: captureRes.raw?.slice(0, 2000),
      });
      return json({
        ok: false,
        reason: "capture_failed",
        message: `PayPal capture did not complete (${captureRes.status}, status=${captureStatus ?? "unknown"})`,
        details: captureRes.body,
      }, 502);
    }

    // 3. Finalize the booking.
    const { error: updateErr } = await admin
      .from("class_bookings")
      .update({
        status: "booked",
        payment_status: "paid",
        payment_id: captureId,
      })
      .eq("id", booking.id);
    if (updateErr) throw Object.assign(updateErr, { code: "BOOKING_UPDATE_FAILED" });

    // 4. Fire-and-forget notification (never block the capture response).
    try {
      await admin.functions.invoke("send-booking-notification", {
        body: { classBookingId: booking.id },
      });
    } catch (e) {
      console.error("[paypal-capture-order] notification invoke failed", e);
    }

    return json({
      ok: true,
      bookingId: booking.id,
      captureId,
      status: "booked",
    });
  } catch (err) {
    console.error("[paypal-capture-order] failed", {
      message: (err as Error).message,
      stack: (err as Error).stack,
      code: (err as any)?.code,
      orderId,
    });
    return json({
      ok: false,
      reason: "capture_error",
      message: (err as Error).message,
    }, 500);
  }
});
