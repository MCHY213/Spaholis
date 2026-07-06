import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface ClassRow {
  id: string;
  title: string;
  max_capacity: number;
  duration_minutes: number;
  instructor: string | null;
}

interface Slot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  duration_minutes: number;
  is_active: boolean;
}

export function AdminWeeklySchedule() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [weeks, setWeeks] = useState(12);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [{ data: cs }, { data: ss }] = await Promise.all([
      supabase.from("classes").select("id,title,max_capacity,duration_minutes,instructor").order("title"),
      supabase.from("class_schedule_template").select("*").order("day_of_week").order("start_time"),
    ]);
    setClasses((cs as ClassRow[]) ?? []);
    setSlots(((ss as Slot[]) ?? []).map((s) => ({ ...s, start_time: s.start_time.slice(0, 5) })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateSlot = (id: string, patch: Partial<Slot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSlot = (day: number) => {
    const cls = classes[0];
    if (!cls) return;
    setSlots((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, class_id: cls.id, day_of_week: day, start_time: "08:00", duration_minutes: cls.duration_minutes || 60, is_active: true },
    ]);
  };

  const removeSlot = async (id: string) => {
    if (!id.startsWith("new-")) {
      const { error } = await supabase.from("class_schedule_template").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
    }
    setSlots((prev) => prev.filter((s) => s.id !== id));
    toast.success("Slot removed");
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Upsert existing + insert new
      for (const s of slots) {
        const payload = {
          class_id: s.class_id,
          day_of_week: s.day_of_week,
          start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
          duration_minutes: s.duration_minutes,
          is_active: s.is_active,
        };
        if (s.id.startsWith("new-")) {
          const { error } = await supabase.from("class_schedule_template").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("class_schedule_template").update(payload).eq("id", s.id);
          if (error) throw error;
        }
      }
      toast.success("Weekly schedule saved");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveCapacity = async (id: string, max_capacity: number) => {
    const { error } = await supabase.from("classes").update({ max_capacity }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Capacity updated");
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, max_capacity } : c)));
  };

  const regenerate = async () => {
    if (!confirm(`Regenerate the next ${weeks} weeks of sessions from the template? Existing unbooked future sessions for these classes will be replaced.`)) return;
    setGenerating(true);
    try {
      const active = slots.filter((s) => s.is_active);
      const classIds = Array.from(new Set(active.map((s) => s.class_id)));
      const capacityByClass = new Map(classes.map((c) => [c.id, c.max_capacity]));

      // Compute Monday of next week (Costa Rica time — use local Monday)
      const today = new Date();
      const day = today.getDay(); // 0=Sun
      const daysUntilMon = ((1 - day + 7) % 7) || 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() + daysUntilMon);
      monday.setHours(0, 0, 0, 0);
      const cutoffISO = monday.toISOString();

      // Delete future non-cancelled sessions for these classes from next Monday onward
      const { error: delErr } = await supabase
        .from("class_schedule")
        .delete()
        .in("class_id", classIds)
        .gte("start_time", cutoffISO);
      if (delErr) throw delErr;

      // Build rows
      const rows: { class_id: string; start_time: string; end_time: string; spots_remaining: number }[] = [];
      for (let w = 0; w < weeks; w++) {
        for (const s of active) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + w * 7 + s.day_of_week);
          const [h, m] = s.start_time.split(":").map(Number);
          d.setHours(h, m, 0, 0);
          const end = new Date(d.getTime() + s.duration_minutes * 60000);
          rows.push({
            class_id: s.class_id,
            start_time: d.toISOString(),
            end_time: end.toISOString(),
            spots_remaining: capacityByClass.get(s.class_id) ?? 15,
          });
        }
      }

      // Insert in batches of 200
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("class_schedule").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      toast.success(`Generated ${rows.length} sessions across ${weeks} weeks`);
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const slotsByDay = DAYS.map((_, i) => slots.filter((s) => s.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time)));

  return (
    <div className="space-y-6">
      {/* Capacities */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-5 border-b border-border">
          <h3 className="font-heading text-lg font-medium text-foreground">Per-Class Capacity</h3>
          <p className="font-body text-xs text-muted-foreground mt-1">Aerial is typically capped at 8; other classes at 15.</p>
        </div>
        <div className="divide-y divide-border">
          {classes.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-foreground truncate">{c.title}</p>
                {c.instructor && <p className="font-body text-xs text-muted-foreground">{c.instructor}</p>}
              </div>
              <label className="font-body text-xs text-muted-foreground">Max</label>
              <Input
                type="number"
                min={1}
                className="w-24"
                defaultValue={c.max_capacity}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0 && v !== c.max_capacity) saveCapacity(c.id, v);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Template */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-medium text-foreground">Weekly Schedule Template</h3>
            <p className="font-body text-xs text-muted-foreground mt-1">Edit the recurring weekly slots, then regenerate the calendar.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={saveAll} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save template"}
            </Button>
            <div className="flex items-center gap-1">
              <label className="font-body text-xs text-muted-foreground">Weeks</label>
              <Input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 12)} className="w-16 h-9" />
            </div>
            <Button size="sm" onClick={regenerate} disabled={generating}>
              <RefreshCw className={`h-4 w-4 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 p-4">
          {DAYS.map((day, i) => (
            <div key={day} className="rounded-xl border border-border bg-muted/20 p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-2">
                <p className="font-body text-xs font-semibold uppercase tracking-wider text-foreground">{day}</p>
                <button onClick={() => addSlot(i)} className="p-1 rounded hover:bg-muted" title="Add slot">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-2">
                {slotsByDay[i].length === 0 && <p className="font-body text-xs text-muted-foreground italic">No classes</p>}
                {slotsByDay[i].map((s) => (
                  <div key={s.id} className="bg-background rounded-lg p-2 border border-border space-y-1.5">
                    <select
                      className="w-full text-xs font-body rounded border border-input bg-background px-1.5 py-1"
                      value={s.class_id}
                      onChange={(e) => updateSlot(s.id, { class_id: e.target.value })}
                    >
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <Input
                        type="time"
                        value={s.start_time}
                        onChange={(e) => updateSlot(s.id, { start_time: e.target.value })}
                        className="h-8 text-xs px-1.5"
                      />
                      <Input
                        type="number"
                        min={5}
                        value={s.duration_minutes}
                        onChange={(e) => updateSlot(s.id, { duration_minutes: Number(e.target.value) })}
                        className="h-8 w-16 text-xs px-1.5"
                        title="Duration (minutes)"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1 text-[10px] font-body text-muted-foreground">
                        <input type="checkbox" checked={s.is_active} onChange={(e) => updateSlot(s.id, { is_active: e.target.checked })} />
                        Active
                      </label>
                      <button onClick={() => removeSlot(s.id)} className="p-1 rounded hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
