import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type AttendeeLabel = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

/** Preset swatches — same spirit as the Acuity label colors. */
const PALETTE = [
  "#38bdf8", "#f59e0b", "#1f2937", "#fb923c", "#22c55e",
  "#ef4444", "#a855f7", "#0ea5e9", "#64748b", "#ec4899",
];

/** Black or white text, whichever stays readable on the given background. */
export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Relative luminance (sRGB coefficients)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

export function LabelChip({ label, className }: { label: AttendeeLabel; className?: string }) {
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight", className)}
      style={{ backgroundColor: label.color, color: readableOn(label.color) }}
    >
      {label.name}
    </span>
  );
}

/**
 * The attendee's label badge — click it to pick, edit or create labels.
 * Falls back to the plain Member/Guest badge when nothing is assigned.
 */
export function AttendeeLabelPicker({
  labelId,
  labels,
  fallback,
  onAssign,
  onLabelsChanged,
}: {
  labelId: string | null;
  labels: AttendeeLabel[];
  fallback: string;
  onAssign: (labelId: string | null) => void | Promise<void>;
  onLabelsChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; color: string }>({ name: "", color: PALETTE[0] });
  const [busy, setBusy] = useState(false);

  const current = labels.find((l) => l.id === labelId) ?? null;

  const resetEditor = () => {
    setEditingId(null);
    setCreating(false);
    setDraft({ name: "", color: PALETTE[0] });
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setDraft({ name: "", color: PALETTE[labels.length % PALETTE.length] });
  };

  const startEdit = (l: AttendeeLabel) => {
    setCreating(false);
    setEditingId(l.id);
    setDraft({ name: l.name, color: l.color });
  };

  const saveDraft = async () => {
    const name = draft.name.trim();
    if (!name) { toast.error("Label name is required"); return; }
    setBusy(true);
    try {
      if (creating) {
        const { error } = await supabase
          .from("attendee_labels")
          .insert({ name, color: draft.color, sort_order: labels.length });
        if (error) throw error;
        toast.success("Label created");
      } else if (editingId) {
        const { error } = await supabase
          .from("attendee_labels")
          .update({ name, color: draft.color, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Label updated");
      }
      resetEditor();
      onLabelsChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save label");
    } finally {
      setBusy(false);
    }
  };

  const deleteLabel = async (l: AttendeeLabel) => {
    if (!confirm(`Delete the "${l.name}" label? It will be removed from any attendee using it.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("attendee_labels").delete().eq("id", l.id);
      if (error) throw error;
      toast.success("Label deleted");
      resetEditor();
      onLabelsChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete label");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (id: string | null) => {
    await onAssign(id);
    setOpen(false);
    resetEditor();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) resetEditor(); }}
    >
      <PopoverTrigger asChild>
        <button type="button" title="Set label" className="shrink-0 focus:outline-none focus:ring-2 focus:ring-ring rounded-full">
          {current
            ? <LabelChip label={current} className="cursor-pointer hover:opacity-85 transition-opacity" />
            : <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted transition-colors">{fallback}</Badge>}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2">
        {labels.length === 0 && !creating && (
          <p className="px-1 py-3 text-center text-xs text-muted-foreground">
            No labels yet. Create your first one below.
          </p>
        )}

        <ul className="max-h-56 overflow-auto space-y-1">
          {labels.map((l) => (
            <li key={l.id}>
              {editingId === l.id ? (
                <LabelEditor
                  draft={draft}
                  setDraft={setDraft}
                  busy={busy}
                  onSave={saveDraft}
                  onCancel={resetEditor}
                  onDelete={() => deleteLabel(l)}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => assign(l.id)}
                    className={cn(
                      "flex-1 text-left rounded-md px-1.5 py-1 hover:bg-muted/60 transition-colors",
                      l.id === labelId && "bg-muted/60",
                    )}
                  >
                    <LabelChip label={l} />
                    {l.id === labelId && <Check className="inline h-3 w-3 ml-1.5 text-muted-foreground" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(l)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    title={`Edit "${l.name}"`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {creating && (
          <div className="mt-1">
            <LabelEditor draft={draft} setDraft={setDraft} busy={busy} onSave={saveDraft} onCancel={resetEditor} />
          </div>
        )}

        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
          {labelId && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => assign(null)}>
              Remove
            </Button>
          )}
          {!creating && !editingId && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startCreate}>
              <Plus className="h-3 w-3 mr-1" /> New label
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LabelEditor({
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
        placeholder="Label name"
        className="h-7 text-xs"
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
