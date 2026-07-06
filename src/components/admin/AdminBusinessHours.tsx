import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SPA_TIMEZONE } from "@/lib/businessHours";
import { useBusinessHoursRows, type BusinessHoursRow } from "@/hooks/useBusinessHours";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Draft = Record<number, BusinessHoursRow>;

function toHHMM(t: string): string {
  // DB may return "09:00:00"; the <input type="time"> wants "HH:MM".
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function AdminBusinessHours() {
  const { data, isLoading } = useBusinessHoursRows();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    if (!data) return;
    const next: Draft = {};
    for (const row of data) {
      next[row.weekday] = {
        ...row,
        open_time: toHHMM(row.open_time),
        close_time: toHHMM(row.close_time),
      };
    }
    setDraft(next);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (rows: BusinessHoursRow[]) => {
      // Update rows one-by-one; the table only has 7 rows so this is cheap
      // and avoids needing an upsert grant on `insert`.
      for (const r of rows) {
        const { error } = await supabase
          .from("business_hours")
          .update({
            is_closed: r.is_closed,
            open_time: r.open_time,
            close_time: r.close_time,
          })
          .eq("weekday", r.weekday);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Business hours updated");
      qc.invalidateQueries({ queryKey: ["business-hours"] });
      qc.invalidateQueries({ queryKey: ["room-availability"] });
      qc.invalidateQueries({ queryKey: ["exp-dynamic-slots"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update business hours");
    },
  });

  const rowsArr = [0, 1, 2, 3, 4, 5, 6].map((w) => draft[w]).filter(Boolean);

  const invalid = rowsArr.some(
    (r) => !r.is_closed && (!r.open_time || !r.close_time || r.close_time <= r.open_time),
  );

  const update = (weekday: number, patch: Partial<BusinessHoursRow>) => {
    setDraft((d) => ({ ...d, [weekday]: { ...d[weekday], ...patch } }));
  };

  const handleSave = () => {
    if (invalid) {
      toast.error("Each open day needs a valid window (close time after open time).");
      return;
    }
    mutation.mutate(rowsArr);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-xl text-foreground mb-1">Business Hours</h3>
        <p className="font-body text-sm text-muted-foreground">
          Weekly open/close window used by both the customer booking calendar and the backend
          validator. Times are wall-clock in <strong>{SPA_TIMEZONE}</strong> (Costa Rica, UTC−6, no DST).
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3">
            {rowsArr.map((row) => {
              const rowInvalid =
                !row.is_closed &&
                (!row.open_time || !row.close_time || row.close_time <= row.open_time);
              return (
                <div
                  key={row.weekday}
                  className="grid grid-cols-1 sm:grid-cols-[8rem_auto_1fr_1fr] items-center gap-3 sm:gap-4 py-2 border-b border-border last:border-b-0"
                >
                  <Label className="font-body font-medium">{WEEKDAY_NAMES[row.weekday]}</Label>

                  <div className="flex items-center gap-2">
                    <Switch
                      id={`open-${row.weekday}`}
                      checked={!row.is_closed}
                      onCheckedChange={(v) => update(row.weekday, { is_closed: !v })}
                    />
                    <Label htmlFor={`open-${row.weekday}`} className="text-sm text-muted-foreground">
                      {row.is_closed ? "Closed" : "Open"}
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-10">Open</Label>
                    <Input
                      type="time"
                      value={row.open_time}
                      disabled={row.is_closed}
                      onChange={(e) => update(row.weekday, { open_time: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-10">Close</Label>
                    <Input
                      type="time"
                      value={row.close_time}
                      disabled={row.is_closed}
                      onChange={(e) => update(row.weekday, { close_time: e.target.value })}
                      aria-invalid={rowInvalid || undefined}
                      className={rowInvalid ? "border-destructive" : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        {invalid && (
          <span className="text-xs text-destructive">Close time must be after open time.</span>
        )}
        <Button onClick={handleSave} disabled={mutation.isPending || invalid || isLoading}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export default AdminBusinessHours;
