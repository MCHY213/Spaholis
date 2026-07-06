import { useState, useEffect } from "react";
import { formatCRC } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface ClientBookingHistoryProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export function ClientBookingHistory({ clientId, clientName, onClose }: ClientBookingHistoryProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("bookings")
        .select("*, services(title)")
        .eq("user_id", clientId)
        .order("booking_date", { ascending: false });
      setBookings(data ?? []);
      setLoading(false);
    }
    load();
  }, [clientId]);

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-medium text-foreground">Booking History</h3>
          <p className="font-body text-sm text-muted-foreground mt-0.5">{clientName}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="p-5 font-body text-sm text-muted-foreground">Loading...</div>
      ) : bookings.length === 0 ? (
        <div className="p-5 font-body text-sm text-muted-foreground">No bookings found for this client.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Date", "Time", "Service", "Status", "Price"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-body text-sm text-foreground">{b.booking_date}</td>
                  <td className="px-5 py-3 font-body text-sm text-foreground">{b.booking_time}</td>
                  <td className="px-5 py-3 font-body text-sm text-muted-foreground">{b.services?.title || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-body font-semibold px-3 py-1 rounded-full ${
                      b.status === "confirmed" || b.status === "completed" ? "bg-spa-sage/15 text-spa-sage" :
                      b.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{b.status}</span>
                  </td>
                  <td className="px-5 py-3 font-body text-sm text-foreground">{b.total_price ? formatCRC(b.total_price) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
