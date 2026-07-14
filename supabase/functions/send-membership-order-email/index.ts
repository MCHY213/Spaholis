// deno-lint-ignore-file no-explicit-any
// Edge function: send-membership-order-email
//
// Sends the "your membership is ready — schedule your classes" email when an
// admin creates a membership/pass order (Acuity-style). Emails the customer AND
// a copy to the admin, via Resend (same setup as send-booking-notification).
//
// Body: { userOfferingId: "<uuid>" }
// The scheduling link carries the offering's secure access_token so the customer
// books eligible classes at $0 without logging in or typing a code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_EMAIL = "info@spaholis.com";
const ADMIN_BACKUP_EMAIL = "spaholisma@gmail.com";
const FROM_ADDRESS = "Holis Wellness <info@spaholis.com>";
const SITE_URL = "https://spaholis.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return { ok: false, error: "email_config_missing" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function customerHtml(o: any, link: string): string {
  const firstName = String(o.guest_name || "").trim().split(/\s+/)[0] || "there";
  const entitlement = o.is_unlimited
    ? "Unlimited classes"
    : `${o.credits_remaining ?? 0} class credit${(o.credits_remaining ?? 0) === 1 ? "" : "s"}`;
  const validity = o.expires_at
    ? `<p style="margin:4px 0;color:#666;font-size:14px;">Valid until ${new Date(o.expires_at).toLocaleDateString()}</p>`
    : "";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
    <h1 style="font-size:22px;margin:0 0 8px;">Hi ${esc(firstName)}, your membership is ready 🌿</h1>
    <p style="font-size:15px;line-height:1.5;">Thank you! Your <strong>${esc(o.name_snapshot)}</strong> is active.</p>
    <div style="background:#f3f6f6;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-weight:bold;">${esc(o.name_snapshot)}</p>
      <p style="margin:4px 0;color:#334155;font-size:14px;">${entitlement}</p>
      ${validity}
      <p style="margin:8px 0 0;color:#666;font-size:13px;">Reference code: <strong style="letter-spacing:1px;">${esc(o.code)}</strong></p>
    </div>
    <p style="font-size:15px;line-height:1.5;">Click below to book any eligible class — the credit is applied automatically, so your total is <strong>$0</strong>. No login or code needed.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${link}" style="background:#1d5b6a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:bold;font-size:16px;display:inline-block;">Schedule your classes</a>
    </p>
    <p style="font-size:13px;color:#666;line-height:1.5;">Or paste this link into your browser:<br><span style="word-break:break-all;">${link}</span></p>
    <p style="font-size:13px;color:#999;margin-top:24px;">Holis Wellness Center · Manuel Antonio, Costa Rica</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, reason: "invalid_json" }, 400); }

  const userOfferingId: string | undefined = body.userOfferingId;
  if (!userOfferingId || !UUID_RE.test(userOfferingId)) {
    return json({ ok: false, reason: "invalid_user_offering_id" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: o, error } = await supabase
    .from("user_offerings")
    .select("id, name_snapshot, code, access_token, is_unlimited, credits_remaining, expires_at, guest_name, guest_email")
    .eq("id", userOfferingId)
    .maybeSingle();

  if (error) return json({ ok: false, reason: "fetch_failed" }, 500);
  if (!o) return json({ ok: false, reason: "not_found" }, 404);
  if (!o.access_token) return json({ ok: false, reason: "no_token" }, 409);
  const to = String(o.guest_email || "").trim();
  if (!to) return json({ ok: false, reason: "no_recipient" }, 409);

  const link = `${SITE_URL}/classes?m=${o.access_token}`;
  const html = customerHtml(o, link);

  // Customer email
  const custRes = await sendEmail(to, `Your Holis membership is ready — ${o.name_snapshot}`, html);

  // Admin copy (+ backup)
  const adminSubj = `[New order] ${o.guest_name || to} — ${o.name_snapshot} (${o.code})`;
  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#1f2937;">
      <h2 style="font-size:18px;">New membership order</h2>
      <p><strong>Customer:</strong> ${esc(o.guest_name || "")} &lt;${esc(to)}&gt;</p>
      <p><strong>Offering:</strong> ${esc(o.name_snapshot)}</p>
      <p><strong>Code:</strong> ${esc(o.code)}</p>
      <p><strong>Scheduling link:</strong><br><span style="word-break:break-all;">${link}</span></p>
    </div>`;
  await sendEmail(ADMIN_EMAIL, adminSubj, adminHtml);
  if (ADMIN_BACKUP_EMAIL && ADMIN_BACKUP_EMAIL !== ADMIN_EMAIL) {
    await sendEmail(ADMIN_BACKUP_EMAIL, `[Backup] ${adminSubj}`, adminHtml);
  }

  if (!custRes.ok) {
    console.error("[send-membership-order-email] customer send failed", custRes.error);
    return json({ ok: false, reason: "customer_send_failed", detail: custRes.error }, 502);
  }
  return json({ ok: true });
});
