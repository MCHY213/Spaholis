import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { toast } from "sonner";

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  applies_to: string | null;
}

export function AdminSettingsManager() {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newApplies, setNewApplies] = useState("all");

  const load = useCallback(async () => {
    const { data } = await supabase.from("blocked_dates").select("*").order("blocked_date", { ascending: true });
    setBlockedDates((data as BlockedDate[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newDate) { toast.error("Please select a date"); return; }
    const { error } = await supabase.from("blocked_dates").insert({
      blocked_date: newDate,
      reason: newReason || null,
      applies_to: newApplies,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Date blocked");
    setNewDate("");
    setNewReason("");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Unblocked");
    load();
  };

  return (
    <div className="space-y-6">
      {/* Business Info */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-heading text-lg font-medium text-foreground mb-4">Business Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Business Name</p>
            <p className="font-body text-sm text-foreground mt-1">Holis Wellness Center</p>
          </div>
          <div>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Location</p>
            <p className="font-body text-sm text-foreground mt-1">Manuel Antonio, Quepos, Costa Rica</p>
          </div>
          <div>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Email</p>
            <p className="font-body text-sm text-foreground mt-1">spaholisma@gmail.com</p>
          </div>
          <div>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Business Hours</p>
            <p className="font-body text-sm text-foreground mt-1">8:00 AM – 8:00 PM Daily</p>
          </div>
        </div>
      </div>

      {/* Blocked Dates */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-heading text-lg font-medium text-foreground mb-4">
          <CalendarOff className="inline h-5 w-5 mr-2 text-muted-foreground" />
          Blocked Dates
        </h3>
        <p className="font-body text-sm text-muted-foreground mb-6">
          Block specific dates to prevent bookings (holidays, maintenance, etc.)
        </p>

        <div className="flex flex-wrap gap-3 items-end mb-6">
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Date</label>
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Reason</label>
            <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. Holiday" />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Applies To</label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-body"
              value={newApplies}
              onChange={(e) => setNewApplies(e.target.value)}
            >
              <option value="all">All Services</option>
              <option value="spa">Spa Only</option>
              <option value="classes">Classes Only</option>
            </select>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" /> Block Date
          </Button>
        </div>

        <div className="divide-y divide-border">
          {blockedDates.map((d) => (
            <div key={d.id} className="flex items-center justify-between py-3">
              <div className="font-body text-sm">
                <span className="font-medium text-foreground">{new Date(d.blocked_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                {d.reason && <span className="text-muted-foreground"> — {d.reason}</span>}
                <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{d.applies_to || "all"}</span>
              </div>
              <button onClick={() => handleDelete(d.id)} className="p-2 hover:bg-destructive/10 rounded-lg">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
          {blockedDates.length === 0 && (
            <p className="py-4 font-body text-sm text-muted-foreground text-center">No blocked dates.</p>
          )}
        </div>
      </div>
    </div>
  );
}
