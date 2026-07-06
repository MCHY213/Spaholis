import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCRC } from "@/lib/currency";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FailedBooking = {
  id: string;
  created_at: string;
  booking_date: string;
  booking_time: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  payment_id: string | null;
  total_price: number | null;
  notes: string | null;
  status: string;
  service_id: string | null;
  user_id: string | null;
  room_id: string | null;
  start_time: string | null;
  end_time: string | null;
  services?: { title: string | null } | null;
};

export function AdminPaymentIssues() {
  const [rows, setRows] = useState<FailedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(title)")
      .eq("status", "payment_failed")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logAudit = async (
    targetId: string,
    result: string,
    details: Record<string, any>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id ?? null,
        action: "retry_booking",
        target_type: "booking",
        target_id: targetId,
        result,
        details,
      });
    } catch (e) {
      console.error("Audit log insert failed:", e);
    }
  };

  const retryBooking = async (row: FailedBooking) => {
    setBusyId(row.id);
    let auditResult = "";
    const auditDetails: Record<string, any> = {
      payment_id: row.payment_id,
      guest_name: row.guest_name,
      guest_email: row.guest_email,
      service_id: row.service_id,
      room_id: row.room_id,
      start_time: row.start_time,
      end_time: row.end_time,
      total_price: row.total_price,
    };

    try {
      // Idempotency guard: ensure no successful booking already exists for this payment.
      if (row.payment_id) {
        const { data: dup, error: dupErr } = await supabase
          .from("bookings")
          .select("id, status")
          .eq("payment_id", row.payment_id)
          .not("status", "in", "(payment_failed,cancelled)")
          .maybeSingle();
        if (dupErr) throw dupErr;
        if (dup?.id) {
          auditResult = `duplicate_prevented: booking ${dup.id.slice(0, 8)} already exists`;
          toast.error(`Duplicate prevented — a booking (${dup.id.slice(0, 8)}) already exists for this payment.`);
          return;
        }
      }

      // Re-check slot availability if this booking has a room + time window.
      if (row.room_id && row.start_time && row.end_time) {
        const { data: conflicts, error: conflictErr } = await supabase
          .from("bookings")
          .select("id")
          .eq("room_id", row.room_id)
          .neq("status", "cancelled")
          .neq("status", "payment_failed")
          .lt("start_time", row.end_time)
          .gt("end_time", row.start_time)
          .limit(1);
        if (conflictErr) throw conflictErr;
        if (conflicts && conflicts.length > 0) {
          auditResult = "slot_conflict: room still occupied";
          toast.error("Slot is still taken — assign a new room/time before retrying.");
          return;
        }
      }

      const cleanedNotes = (row.notes || "")
        .replace(/\[PAYMENT CAPTURED — BOOKING NOT CREATED\][^|]*\|[^|]*\|/i, "")
        .trim();

      const { error } = await supabase
        .from("bookings")
        .update({ status: "paid", notes: cleanedNotes || null })
        .eq("id", row.id);
      if (error) throw error;

      auditResult = "success: booking marked as paid";
      toast.success("Booking reconciled — marked as paid.");
      await load();
    } catch (err: any) {
      auditResult = `error: ${err?.message || "Retry failed"}`;
      toast.error(err?.message || "Retry failed");
    } finally {
      setBusyId(null);
      await logAudit(row.id, auditResult, auditDetails);
    }
  };

  const cancelBooking = async (row: FailedBooking) => {
    if (!confirm("Cancel this failed booking? The payment record is preserved for refund processing.")) return;
    setBusyId(row.id);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Booking cancelled. Process refund in BAC CompraClick separately.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Cancel failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-medium text-foreground">Payment Issues</h3>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              Payments captured by BAC CompraClick where booking creation failed. Reconcile or refund.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center font-body text-sm text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-spa-sage mx-auto mb-2" />
          <p className="font-body text-sm text-muted-foreground">No payment issues. All captured payments have bookings.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["When", "Guest", "Service", "Date / Time", "Payment ID", "Amount", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors align-top">
                  <td className="px-5 py-4 font-body text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 font-body text-sm">
                    <div className="font-medium text-foreground">{r.guest_name || "—"}</div>
                    {r.guest_email && <div className="text-xs text-muted-foreground">{r.guest_email}</div>}
                    {r.guest_phone && <div className="text-xs text-muted-foreground">{r.guest_phone}</div>}
                  </td>
                  <td className="px-5 py-4 font-body text-sm text-muted-foreground">{r.services?.title || "—"}</td>
                  <td className="px-5 py-4 font-body text-sm text-foreground whitespace-nowrap">
                    {r.booking_date}<br />
                    <span className="text-xs text-muted-foreground">{r.booking_time}</span>
                  </td>
                  <td className="px-5 py-4 font-body text-xs font-mono text-foreground break-all max-w-[200px]">{r.payment_id || "—"}</td>
                  <td className="px-5 py-4 font-body text-sm text-foreground whitespace-nowrap">{r.total_price ? formatCRC(r.total_price) : "—"}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5">
                      <Button
                        variant="default"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => retryBooking(r)}
                        disabled={busyId === r.id}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Retry
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-destructive"
                        onClick={() => cancelBooking(r)}
                        disabled={busyId === r.id}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-border bg-muted/30">
            <p className="font-body text-xs text-muted-foreground">
              <strong>Retry</strong> re-checks slot availability and marks the booking as paid.{" "}
              <strong>Cancel</strong> marks the booking cancelled — process the refund in your BAC CompraClick dashboard using the Payment ID.
            </p>
          </div>
        </div>
      )}

      {/* Notes expansion for each row */}
      {rows.length > 0 && (
        <details className="border-t border-border">
          <summary className="px-5 py-3 font-body text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
            View failure notes ({rows.length})
          </summary>
          <div className="px-5 pb-5 space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="text-xs font-body bg-muted/40 p-3 rounded-lg">
                <div className="font-mono text-muted-foreground mb-1">{r.payment_id}</div>
                <div className="text-foreground whitespace-pre-wrap">{r.notes || "(no notes)"}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
