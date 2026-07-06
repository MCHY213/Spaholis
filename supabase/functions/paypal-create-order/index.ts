// deno-lint-ignore-file no-explicit-any
// Edge function: paypal-create-order
//
// Server-side entry point for prepaid studio-class bookings.
//
// Flow:
//  1. Validate the requested schedule + class + coupon.
//  2. Recompute the USD amount from the DB (never trust the client price).
//  3. Insert a PENDING class_bookings row using the service role
//     (RLS-safe for guest checkout).
//  4. Create a PayPal order via the REST API and persist the order id
//     on the booking so the capture step can look it up.
//  5. Return { orderId, bookingId, amountUsd } for the PayPal JS SDK.
//
// The booking is NOT considered confirmed until paypal-capture-order
// succeeds — see that function for the second half of the flow.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.25.76";
import {
  getPayPalAccessToken,
  paypalEnvironment,
  paypalFetch,
} from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  schedule_id: z.string().uuid(),
  guest_name: z.string().trim().min(2).max(100),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(30).optional().nullable(),
  coupon_code: z.string().trim().max(64).optional().nullable(),
  booking_id: z.string().uuid().optional(),
});

type Body = z.infer<typeof BodySchema>;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Prices are stored in USD directly — no Colones conversion.
function normalizeUsd(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}


async function getAuthenticatedUserId(req: Request, admin: any): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function validateCoupon(
  admin: any,
  codeRaw: string | null | undefined,
  basePrice: number,
  classId: string,
): Promise<{ code: string | null; discount: number }> {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code) return { code: null, discount: 0 };

  const { data: coupon, error } = await admin
    .from("coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error || !coupon) throw Object.assign(new Error("Coupon not found"), { code: "INVALID_COUPON" });
  if (!coupon.is_active) throw Object.assign(new Error("Coupon inactive"), { code: "INVALID_COUPON" });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    throw Object.assign(new Error("Coupon expired"), { code: "INVALID_COUPON" });
  }
  if (coupon.max_uses != null && coupon.current_uses >= coupon.max_uses) {
    throw Object.assign(new Error("Coupon usage limit reached"), { code: "INVALID_COUPON" });
  }
  if (Array.isArray(coupon.restricted_class_ids) && coupon.restricted_class_ids.length > 0) {
    if (!coupon.restricted_class_ids.includes(classId)) {
      throw Object.assign(new Error("Coupon does not apply to this class"), { code: "INVALID_COUPON" });
    }
  }

  const discount = coupon.discount_type === "percentage"
    ? Math.round(basePrice * (Number(coupon.discount_value) / 100) * 100) / 100
    : Math.min(basePrice, Number(coupon.discount_value));

  return { code: coupon.code as string, discount: Number.isFinite(discount) ? discount : 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let parsed: z.SafeParseReturnType<unknown, Body>;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }
  if (!parsed.success) {
    return json({ ok: false, reason: "invalid_body", errors: parsed.error.flatten().fieldErrors }, 400);
  }

  const body = parsed.data;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Load schedule + class from the DB so pricing can't be tampered with.
    const { data: schedule, error: scheduleErr } = await admin
      .from("class_schedule")
      .select("id, class_id, start_time, end_time, is_cancelled, classes(id, title, price, requires_payment, capacity)")
      .eq("id", body.schedule_id)
      .maybeSingle();

    if (scheduleErr) throw scheduleErr;
    if (!schedule) return json({ ok: false, reason: "schedule_not_found" }, 404);
    if (schedule.is_cancelled) return json({ ok: false, reason: "schedule_cancelled" }, 409);

    const cls: any = schedule.classes;
    if (!cls) return json({ ok: false, reason: "class_not_found" }, 404);
    if (!cls.requires_payment || !(Number(cls.price) > 0)) {
      return json({ ok: false, reason: "class_not_paid" }, 400);
    }
    if (new Date(schedule.start_time).getTime() < Date.now() - 60_000) {
      return json({ ok: false, reason: "schedule_past" }, 409);
    }

    // 2. Recompute price + coupon (all values in USD — no Colones math).
    const basePrice = normalizeUsd(cls.price);
    const coupon = await validateCoupon(admin, body.coupon_code, basePrice, cls.id);
    const amountUsd = Math.max(0, Math.round((basePrice - coupon.discount) * 100) / 100);
    if (amountUsd <= 0) return json({ ok: false, reason: "invalid_amount" }, 400);

    const userId = await getAuthenticatedUserId(req, admin);
    const bookingId = body.booking_id && UUID_RE.test(body.booking_id)
      ? body.booking_id
      : crypto.randomUUID();

    // 3. Insert PENDING booking (idempotent on retry of the same booking_id).
    const insertPayload: Record<string, any> = {
      id: bookingId,
      schedule_id: body.schedule_id,
      user_id: userId,
      guest_name: body.guest_name,
      guest_email: body.guest_email,
      status: "pending_payment",
      payment_status: "pending",
      payment_method: "paypal",
      coupon_code: coupon.code,
      discount_amount: coupon.discount,
      total_price: amountUsd,
    };
    const { error: insertErr } = await admin
      .from("class_bookings")
      .upsert(insertPayload, { onConflict: "id" });
    if (insertErr) throw Object.assign(insertErr, { code: "BOOKING_INSERT_FAILED" });

    // 4. Create the PayPal order.
    const accessToken = await getPayPalAccessToken();
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: bookingId,
          description: `${cls.title} — ${new Date(schedule.start_time).toISOString()}`.slice(0, 127),
          custom_id: bookingId,
          amount: {
            currency_code: "USD",
            value: amountUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Holis Wellness Center",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    };
    const orderRes = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      accessToken,
      body: JSON.stringify(orderPayload),
    });
    if (orderRes.status < 200 || orderRes.status >= 300 || !orderRes.body?.id) {
      // Roll back the pending booking so the seat isn't held on a failed order.
      await admin.from("class_bookings").delete().eq("id", bookingId);
      throw Object.assign(
        new Error(`PayPal order create failed (${orderRes.status}): ${orderRes.raw}`),
        { code: "PAYPAL_CREATE_FAILED" },
      );
    }

    const orderId = String(orderRes.body.id);

    // 5. Persist the PayPal order id on the booking for the capture lookup.
    const { error: updateErr } = await admin
      .from("class_bookings")
      .update({ paypal_order_id: orderId })
      .eq("id", bookingId);
    if (updateErr) {
      console.error("[paypal-create-order] failed to persist order id", updateErr);
    }

    return json({
      ok: true,
      orderId,
      bookingId,
      amountUsd,
      environment: paypalEnvironment(),
    });
  } catch (err) {
    console.error("[paypal-create-order] failed", {
      message: (err as Error).message,
      stack: (err as Error).stack,
      code: (err as any)?.code,
    });
    const code = (err as any)?.code;
    if (code === "INVALID_COUPON") {
      return json({ ok: false, reason: "invalid_coupon", message: (err as Error).message }, 400);
    }
    if (code === "PAYPAL_CREATE_FAILED") {
      return json({ ok: false, reason: "paypal_create_failed", message: (err as Error).message }, 502);
    }
    return json({ ok: false, reason: "create_failed", message: (err as Error).message }, 500);
  }
});
