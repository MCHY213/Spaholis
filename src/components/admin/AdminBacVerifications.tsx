import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AdminBacVerifications
 *
 * Shows the BAC CompraClick return-URL verification outcome for every
 * pending / recently pending booking, along with the specific validation
 * failure reason produced by the `finalize-booking` edge function.
 *
 * Data source: audit_logs rows with action = 'bac_return_verification'.
 * The edge function writes exactly one entry per verification attempt so
 * admins can trace why a booking did or did not transition.
 */

type VerificationLog = {
  id: string;
  target_id: string | null;
  result: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

type BookingLite = {
  id: string;
  status: string;
  guest_name: string | null;
  guest_email: string | null;
  booking_date: string | null;
  booking_time: string | null;
  total_price: number | null;
  services?: { title: string | null } | null;
};

type Row = {
  bookingId: string;
  booking: BookingLite | null;
  latest: VerificationLog | null;
  attempts: number;
};

// Human-friendly labels for every reason string finalize-booking may emit.
const REASON_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "fail" }> = {
  paid: { label: "Verified & paid", tone: "ok" },
  already_paid: { label: "Already paid (idempotent)", tone: "ok" },
  payment_failed: { label: "Declined / cancelled by BAC", tone: "fail" },
  already_failed: { label: "Already marked failed", tone: "warn" },
  not_found: { label: "Booking not found", tone: "fail" },
  fetch_failed: { label: "Database fetch error", tone: "fail" },
  update_failed: { label: "Database update error", tone: "fail" },
  wrong_state: { label: "Booking not in pending_payment", tone: "warn" },
  expired: { label: "Pending window (3h) exceeded", tone: "fail" },
  email_mismatch: { label: "Guest email did not match booking", tone: "fail" },
  amount_mismatch: { label: "BAC amount did not match deposit", tone: "fail" },
  no_status: { label: "BAC did not return a status", tone: "warn" },
};

const toneClasses: Record<"ok" | "warn" | "fail", string> = {
  ok: "bg-spa-sage/15 text-spa-sage border-spa-sage/30",
  warn: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  fail: "bg-destructive/10 text-destructive border-destructive/30",
};

export function AdminBacVerifications() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_payment" | "payment_failed" | "paid">("pending_payment");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch the last 200 verification attempts, newest first.
      const { data: logs, error: logErr } = await supabase
        .from("audit_logs")
        .select("id, target_id, result, details, created_at")
        .eq("action", "bac_return_verification")
        .order("created_at", { ascending: false })
        .limit(200);
      if (logErr) throw logErr;

      // 2. Group by booking, count attempts, keep latest.
      const byBooking = new Map<string, { latest: VerificationLog; attempts: number }>();
      for (const l of (logs as VerificationLog[]) ?? []) {
        if (!l.target_id) continue;
        const prev = byBooking.get(l.target_id);
        if (prev) {
          prev.attempts += 1;
        } else {
          byBooking.set(l.target_id, { latest: l, attempts: 1 });
        }
      }

      const bookingIds = Array.from(byBooking.keys());

      // 3. Also include any current pending_payment bookings with no log yet
      //    so admins can spot them and reach out proactively.
      const { data: pending, error: pendErr } = await supabase
        .from("bookings")
        .select("id, status, guest_name, guest_email, booking_date, booking_time, total_price, services(title)")
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(50);
      if (pendErr) throw pendErr;

      const allIds = new Set<string>(bookingIds);
      for (const p of (pending as any[]) ?? []) allIds.add(p.id);

      let bookings: BookingLite[] = [];
      if (allIds.size > 0) {
        const { data: bks, error: bkErr } = await supabase
          .from("bookings")
          .select("id, status, guest_name, guest_email, booking_date, booking_time, total_price, services(title)")
          .in("id", Array.from(allIds));
        if (bkErr) throw bkErr;
        bookings = (bks as any[]) ?? [];
      }
      const bookingMap = new Map(bookings.map((b) => [b.id, b]));

      const merged: Row[] = Array.from(allIds).map((id) => {
        const entry = byBooking.get(id);
        return {
          bookingId: id,
          booking: bookingMap.get(id) ?? null,
          latest: entry?.latest ?? null,
          attempts: entry?.attempts ?? 0,
        };
      });

      // Sort: pending first, then newest activity.
      merged.sort((a, b) => {
        const ap = a.booking?.status === "pending_payment" ? 0 : 1;
        const bp = b.booking?.status === "pending_payment" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const at = a.latest?.created_at ?? "";
        const bt = b.latest?.created_at ?? "";
        return bt.localeCompare(at);
      });

      setRows(merged);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load verifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (statusFilter === "all") return true;
    return r.booking?.status === statusFilter;
  });

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-medium text-foreground">BAC Return Verifications</h3>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              Every /booking/return validation result, per pending booking, with the exact rejection reason.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-sm rounded-lg border border-border bg-background px-3 py-1.5"
          >
            <option value="pending_payment">Pending payment</option>
            <option value="payment_failed">Payment failed</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center font-body text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-spa-sage mx-auto mb-2" />
          <p className="font-body text-sm text-muted-foreground">
            No bookings match this filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Booking", "Guest", "Service", "Booking status", "Latest verification", "Reason", "Attempts", "When"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => {
                const result = row.latest?.result ?? null;
                const meta = result ? REASON_LABELS[result] : null;
                const bookingStatus = row.booking?.status ?? "unknown";
                const bookingTone: "ok" | "warn" | "fail" =
                  bookingStatus === "paid"
                    ? "ok"
                    : bookingStatus === "payment_failed" || bookingStatus === "cancelled"
                      ? "fail"
                      : "warn";
                return (
                  <tr key={row.bookingId} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="px-5 py-4 font-mono text-xs text-foreground whitespace-nowrap">
                      {row.bookingId.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-5 py-4 font-body text-sm">
                      <div className="font-medium text-foreground">{row.booking?.guest_name || "—"}</div>
                      {row.booking?.guest_email && (
                        <div className="text-xs text-muted-foreground">{row.booking.guest_email}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-body text-sm text-muted-foreground">
                      {row.booking?.services?.title || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", toneClasses[bookingTone])}>
                        {bookingStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {result ? (
                        <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", toneClasses[meta?.tone ?? "warn"])}>
                          {result}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> Never verified
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-body text-xs text-muted-foreground max-w-[280px]">
                      {result ? (
                        <>
                          <div className="text-foreground">{meta?.label ?? result}</div>
                          {row.latest?.details?.reason && (
                            <div className="mt-0.5">BAC status: {String(row.latest.details.reason)}</div>
                          )}
                          {row.latest?.details?.returned_amount != null && (
                            <div className="mt-0.5">
                              BAC amount ${String(row.latest.details.returned_amount)} vs expected ${String(row.latest.details.expected_amount)}
                            </div>
                          )}
                          {row.latest?.details?.error && (
                            <div className="mt-0.5 text-destructive">{String(row.latest.details.error)}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Customer never returned from BAC.</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground">{row.attempts || "0"}</td>
                    <td className="px-5 py-4 font-body text-xs text-muted-foreground whitespace-nowrap">
                      {row.latest?.created_at
                        ? new Date(row.latest.created_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-4 border-t border-border bg-muted/30">
            <p className="font-body text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                "Never verified" pending bookings are candidates for the automatic 3h reconciliation job — or for a manual follow-up.
                Rejection reasons come directly from the finalize-booking edge function (email_mismatch, amount_mismatch, expired, etc.).
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
