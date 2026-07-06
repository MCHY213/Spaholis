import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";

export interface TagRow {
  id: string;
  label: string;
  slug: string;
  color: string | null;
}

interface TagsInputProps {
  /** Logical table key, e.g. "products", "retreats", "blog_posts" */
  contentTable: string;
  /** Row id of the content. When undefined the picker still works locally
   *  and onChange returns selected tag ids; you must persist after save. */
  contentId?: string;
  /** Controlled tag id list (optional). If omitted, component manages
   *  its own state from the DB for the given contentId. */
  value?: string[];
  onChange?: (tagIds: string[]) => void;
}

/** Curated-tag picker backed by `tags` and `content_tags`. */
export function TagsInput({ contentTable, contentId, value, onChange }: TagsInputProps) {
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [selected, setSelected] = useState<string[]>(value ?? []);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("label", { ascending: true });
    if (error) toast.error(error.message);
    setAllTags((data as TagRow[]) ?? []);
  }, []);

  const loadAssigned = useCallback(async () => {
    if (!contentId) return;
    const { data, error } = await supabase
      .from("content_tags")
      .select("tag_id")
      .eq("content_table", contentTable)
      .eq("content_id", contentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelected((data ?? []).map((r: any) => r.tag_id));
  }, [contentTable, contentId]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadAssigned(); }, [loadAssigned]);
  useEffect(() => { if (value) setSelected(value); }, [value]);

  const persist = async (next: string[]) => {
    setSelected(next);
    onChange?.(next);
    if (!contentId) return;
    // Replace links: simplest correct approach for small lists.
    const { error: delErr } = await supabase
      .from("content_tags")
      .delete()
      .eq("content_table", contentTable)
      .eq("content_id", contentId);
    if (delErr) { toast.error(delErr.message); return; }
    if (next.length) {
      const rows = next.map((tag_id, i) => ({
        tag_id,
        content_table: contentTable,
        content_id: contentId,
        sort_order: i,
      }));
      const { error: insErr } = await supabase.from("content_tags").insert(rows);
      if (insErr) toast.error(insErr.message);
    }
  };

  const toggle = (tagId: string) => {
    const next = selected.includes(tagId)
      ? selected.filter((t) => t !== tagId)
      : [...selected, tagId];
    persist(next);
  };

  const createTag = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setLoading(true);
    const slug = slugify(label);
    const { data, error } = await supabase
      .from("tags")
      .insert({ label, slug })
      .select()
      .single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setNewLabel("");
    await loadAll();
    if (data) persist([...selected, (data as any).id]);
  };

  const selectedTags = allTags.filter((t) => selected.includes(t.id));
  const availableTags = allTags.filter((t) => !selected.includes(t.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selectedTags.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No tags selected</span>
        )}
        {selectedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body"
            style={{ backgroundColor: t.color ?? "hsl(var(--muted))", color: t.color ? "white" : undefined }}
          >
            {t.label}
            <button type="button" onClick={() => toggle(t.id)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {availableTags.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Available</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted text-xs font-body border border-border"
              >
                <Plus className="h-2.5 w-2.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTag(); } }}
          placeholder="Create new tag..."
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={createTag} disabled={loading || !newLabel.trim()}>
          Create
        </Button>
      </div>
    </div>
  );
}
