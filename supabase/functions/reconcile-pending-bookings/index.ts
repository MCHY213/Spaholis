// deno-lint-ignore-file no-explicit-any
// Edge function: reconcile-pending-bookings
//
// Periodic reconciliation for BAC CompraClick payments. Because CompraClick
// hosted checkout does not push server-to-server webhooks by default, we
// depend on the customer landing back on /booking/return. If they close the
// tab or the redirect fails, the booking would sit in `pending_payment`
// forever.
//
// This function expires any `pending_payment` row older than
// PENDING_EXPIRY_MS to `payment_failed`, appends a reconciliation note, and
// records an audit_log entry per row so staff can investigate.
//
// Meant to be triggered on a schedule (pg_cron -> net.http_post). Can also
// be called ad-hoc by an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PENDING_EXPIRY_MS = 3 * 60 * 60 * 1000; // 3 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - PENDING_EXPIRY_MS).toISOString();

  const { data: stale, error } = await supabase
    .from("bookings")
    .select("id, guest_email, notes, created_at")
    .eq("status", "pending_payment")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[reconcile] fetch error", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; status: string }> = [];
  for (const row of stale ?? []) {
    const reconciliationNote = `[AUTO-RECONCILED] Expired from pending_payment at ${new Date().toISOString()} (no BAC return received within 3h).`;
    const nextNotes = row.notes ? `${row.notes}\n${reconciliationNote}` : reconciliationNote;

    const { data: updated, error: updErr } = await supabase
      .from("bookings")
      .update({ status: "payment_failed", notes: nextNotes })
      .eq("id", row.id)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    if (updErr) {
      console.error("[reconcile] update failed", row.id, updErr);
      results.push({ id: row.id, status: "update_failed" });
      continue;
    }
    if (!updated) {
      results.push({ id: row.id, status: "skipped_state_changed" });
      continue;
    }

    await supabase.from("audit_logs").insert({
      action: "booking.auto_reconcile",
      target_id: row.id,
      result: "expired_to_payment_failed",
      details: {
        reason: "pending_payment_timeout",
        created_at: row.created_at,
        guest_email: row.guest_email,
      },
    });

    results.push({ id: row.id, status: "expired" });
  }

  return new Response(
    JSON.stringify({ ok: true, examined: stale?.length ?? 0, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
