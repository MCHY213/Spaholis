import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";

interface TagRow {
  id: string;
  label: string;
  slug: string;
  color: string | null;
  description: string | null;
}

const empty: Omit<TagRow, "id"> = { label: "", slug: "", color: null, description: null };

export function AdminTagsManager() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [editing, setEditing] = useState<TagRow | (Omit<TagRow, "id"> & { id?: string }) | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("tags").select("*").order("label");
    if (error) toast.error(error.message);
    setRows((data as TagRow[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.label.trim()) { toast.error("Label is required"); return; }
    const payload = {
      label: editing.label.trim(),
      slug: slugify(editing.slug || editing.label),
      color: editing.color,
      description: editing.description,
    };
    if ("id" in editing && editing.id) {
      const { error } = await supabase.from("tags").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Tag updated");
    } else {
      const { error } = await supabase.from("tags").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Tag created");
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tag? It will be removed from all linked content.")) return;
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-medium text-foreground">Tags</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Curated tags can be assigned to any content type.</p>
          </div>
          <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> New tag</Button>
        </div>

        {editing && (
          <div className="p-5 border-b border-border bg-muted/20 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Label *</label>
                <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug</label>
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder={slugify(editing.label)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Color (hex)</label>
                <div className="flex gap-2">
                  <Input type="color" value={editing.color ?? "#888888"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-9 w-14 p-1" />
                  <Input value={editing.color ?? ""} onChange={(e) => setEditing({ ...editing, color: e.target.value || null })} placeholder="#aabbcc" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value || null })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left">
              <tr>
                <th className="p-3 font-medium">Label</th>
                <th className="p-3 font-medium">Slug</th>
                <th className="p-3 font-medium">Color</th>
                <th className="p-3 font-medium">Description</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No tags yet.</td></tr>
              ) : rows.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body" style={{ backgroundColor: t.color ?? "hsl(var(--muted))", color: t.color ? "white" : undefined }}>
                      {t.label}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{t.slug}</td>
                  <td className="p-3">{t.color && <div className="h-5 w-5 rounded border border-border" style={{ backgroundColor: t.color }} />}</td>
                  <td className="p-3 text-muted-foreground">{t.description}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
