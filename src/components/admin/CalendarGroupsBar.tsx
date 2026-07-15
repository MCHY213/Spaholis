import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PALETTE } from "./AttendeeLabelPicker";

export interface CalendarGroup {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

/**
 * The sub-calendar legend: one chip per calendar, click to show/hide its
 * entries, plus a manager to create, recolor, rename and delete them.
 */
export function CalendarGroupsBar({
  groups,
  hidden,
  onToggle,
  onChanged,
}: {
  groups: CalendarGroup[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onChanged: () => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", color: PALETTE[0] });
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditingId(null);
    setCreating(false);
    setDraft({ name: "", color: PALETTE[0] });
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      if (creating) {
        const { error } = await supabase
          .from("calendar_groups")
          .insert({ name, color: draft.color, sort_order: groups.length });
        if (error) throw error;
        toast.success("Calendar created");
      } else if (editingId) {
        const { error } = await supabase
          .from("calendar_groups")
          .update({ name, color: draft.color, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Calendar updated");
      }
      reset();
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save calendar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g: CalendarGroup) => {
    if (!confirm(`Delete the "${g.name}" calendar? Its entries stay on the schedule and go back to the default color.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("calendar_groups").delete().eq("id", g.id);
      if (error) throw error;
      toast.success("Calendar deleted");
      reset();
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete calendar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {groups.map((g) => {
          const off = hidden.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onToggle(g.id)}
              title={off ? `Show ${g.name}` : `Hide ${g.name}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                off ? "border-border text-muted-foreground opacity-60" : "border-transparent text-foreground",
              )}
              style={off ? undefined : { backgroundColor: `${g.color}22` }}
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-full border", off && "bg-transparent")}
                style={off ? { borderColor: g.color } : { backgroundColor: g.color, borderColor: g.color }}
              />
              {g.name}
            </button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setManageOpen(true)}
        >
          <SlidersHorizontal className="h-3 w-3 mr-1" />
          {groups.length ? "Manage calendars" : "Add calendars"}
        </Button>
      </div>

      <Dialog open={manageOpen} onOpenChange={(o) => { setManageOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calendars</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Group entries into colored calendars — therapists, on-call, no-shows, whatever you track.
          </p>

          <div className="space-y-1.5 max-h-72 overflow-auto">
            {groups.length === 0 && !creating && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No calendars yet. Create your first one below.
              </p>
            )}
            {groups.map((g) =>
              editingId === g.id ? (
                <GroupEditor
                  key={g.id}
                  draft={draft}
                  setDraft={setDraft}
                  busy={busy}
                  onSave={save}
                  onCancel={reset}
                  onDelete={() => remove(g)}
                />
              ) : (
                <div key={g.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="flex-1 truncate text-sm">{g.name}</span>
                  <button
                    type="button"
                    className="p-1 rounded text-muted-foreground hover:bg-muted"
                    title={`Edit "${g.name}"`}
                    onClick={() => { setCreating(false); setEditingId(g.id); setDraft({ name: g.name, color: g.color }); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              ),
            )}
            {creating && (
              <GroupEditor draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={reset} />
            )}
          </div>

          {!creating && !editingId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setEditingId(null); setCreating(true); setDraft({ name: "", color: PALETTE[groups.length % PALETTE.length] }); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New calendar
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupEditor({
  draft, setDraft, busy, onSave, onCancel, onDelete,
}: {
  draft: { name: string; color: string };
  setDraft: (d: { name: string; color: string }) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <Input
        autoFocus
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="Calendar name (e.g. Ashley, No show)"
        className="h-8 text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setDraft({ ...draft, color: c })}
            className={cn(
              "h-5 w-5 rounded-full border transition-transform",
              draft.color === c ? "border-foreground scale-110" : "border-transparent",
            )}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" className="h-6 text-xs" onClick={onSave} disabled={busy}>Save</Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onCancel} disabled={busy}>Cancel</Button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs ml-auto text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
