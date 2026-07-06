import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Link2 } from "lucide-react";
import { toast } from "sonner";

type TableKey = "products" | "retreats" | "services" | "blog_posts" | "spa_packages";

interface TargetRow {
  id: string;
  label: string;
  cover?: string | null;
}

interface RelationshipsEditorProps {
  sourceTable: TableKey;
  sourceId?: string;
  targetTable: TableKey;
  relationType?: string;
  title?: string;
}

const LABEL_FIELD: Record<TableKey, string> = {
  products: "name",
  retreats: "title",
  services: "title",
  blog_posts: "title",
  spa_packages: "name",
};

const IMAGE_FIELD: Record<TableKey, string> = {
  products: "cover_image",
  retreats: "image_url",
  services: "image_url",
  blog_posts: "cover_image",
  spa_packages: "image_url",
};

/** Generic 1:N linker writing to public.content_relationships. */
export function RelationshipsEditor({
  sourceTable,
  sourceId,
  targetTable,
  relationType = "related",
  title,
}: RelationshipsEditorProps) {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [picker, setPicker] = useState<string>("");

  const labelField = LABEL_FIELD[targetTable];
  const imgField = IMAGE_FIELD[targetTable];

  const loadTargets = useCallback(async () => {
    const { data, error } = await supabase
      .from(targetTable)
      .select(`id, ${labelField}, ${imgField}`)
      .order(labelField, { ascending: true });
    if (error) { toast.error(error.message); return; }
    setTargets(((data as any[]) ?? []).map((r) => ({
      id: r.id,
      label: r[labelField] ?? "(untitled)",
      cover: r[imgField] ?? null,
    })));
  }, [targetTable, labelField, imgField]);

  const loadLinks = useCallback(async () => {
    if (!sourceId) { setLinked([]); return; }
    const { data, error } = await supabase
      .from("content_relationships")
      .select("target_id")
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .eq("target_table", targetTable)
      .eq("relation_type", relationType)
      .order("sort_order");
    if (error) { toast.error(error.message); return; }
    setLinked((data ?? []).map((r: any) => r.target_id));
  }, [sourceTable, sourceId, targetTable, relationType]);

  useEffect(() => { loadTargets(); }, [loadTargets]);
  useEffect(() => { loadLinks(); }, [loadLinks]);

  const addLink = async (targetId: string) => {
    if (!sourceId) { toast.error("Save the item first to link related content."); return; }
    if (linked.includes(targetId)) return;
    const { error } = await supabase.from("content_relationships").insert({
      source_table: sourceTable,
      source_id: sourceId,
      target_table: targetTable,
      target_id: targetId,
      relation_type: relationType,
      sort_order: linked.length,
    });
    if (error) { toast.error(error.message); return; }
    setLinked([...linked, targetId]);
    setPicker("");
  };

  const removeLink = async (targetId: string) => {
    if (!sourceId) return;
    const { error } = await supabase
      .from("content_relationships")
      .delete()
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .eq("target_table", targetTable)
      .eq("target_id", targetId)
      .eq("relation_type", relationType);
    if (error) { toast.error(error.message); return; }
    setLinked(linked.filter((id) => id !== targetId));
  };

  const linkedTargets = targets.filter((t) => linked.includes(t.id));
  const availableTargets = targets.filter((t) => !linked.includes(t.id));

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-heading text-sm font-medium text-foreground">
          {title ?? `Linked ${targetTable}`}
        </h4>
      </div>

      {!sourceId && (
        <p className="text-xs text-muted-foreground italic">Save first to enable linking.</p>
      )}

      {linkedTargets.length > 0 && (
        <div className="space-y-1.5">
          {linkedTargets.map((t) => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
              {t.cover && <img src={t.cover} alt="" className="h-8 w-8 rounded object-cover" />}
              <span className="text-sm font-body flex-1 truncate">{t.label}</span>
              <button
                type="button"
                onClick={() => removeLink(t.id)}
                className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {sourceId && availableTargets.length > 0 && (
        <div className="flex gap-2">
          <Select value={picker} onValueChange={(v) => addLink(v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={`Add ${targetTable}...`} />
            </SelectTrigger>
            <SelectContent>
              {availableTargets.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
