import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tag, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagOption {
  id: string;
  label: string;
  color: string | null;
}

interface TagFilterProps {
  /** Logical content table key, e.g. "products", "blog_posts". */
  contentTable: string;
  /** Currently selected tag ids. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Multi-select tag picker for filtering admin tables.
 * Loads only tags actually used by the given content table so the menu
 * stays relevant.
 */
export function TagFilter({ contentTable, value, onChange }: TagFilterProps) {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    // 1) Find tag ids in use for this content table
    const { data: links, error: linkErr } = await supabase
      .from("content_tags")
      .select("tag_id")
      .eq("content_table", contentTable);
    if (linkErr) return;
    const ids = Array.from(new Set((links ?? []).map((r: any) => r.tag_id)));
    if (ids.length === 0) { setTags([]); return; }
    // 2) Hydrate tag rows
    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, label, color")
      .in("id", ids)
      .order("label");
    setTags((tagRows as TagOption[]) ?? []);
  }, [contentTable]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const clear = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Tag className="h-4 w-4 mr-1.5" />
          Tags
          {value.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
              {value.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">Filter by tag</span>
          {value.length > 0 && (
            <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="h-3 w-3" /> clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {tags.length === 0 ? (
            <div className="text-xs text-muted-foreground italic px-2 py-3 text-center">
              No tags assigned to this content yet.
            </div>
          ) : tags.map((t) => {
            const active = value.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted text-left",
                  active && "bg-muted"
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: t.color ?? "transparent" }}
                />
                <span className="flex-1 truncate">{t.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Hook returning a map of contentId -> tag ids for a given content table.
 * Lets admin tables filter rows by selected tags without N+1 queries.
 */
export function useContentTagMap(contentTable: string, refreshKey?: unknown) {
  const [map, setMap] = useState<Record<string, string[]>>({});
  const [tagLookup, setTagLookup] = useState<Record<string, TagOption>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: links } = await supabase
        .from("content_tags")
        .select("content_id, tag_id, sort_order")
        .eq("content_table", contentTable)
        .order("sort_order");
      const next: Record<string, string[]> = {};
      const ids = new Set<string>();
      (links ?? []).forEach((r: any) => {
        ids.add(r.tag_id);
        (next[r.content_id] ||= []).push(r.tag_id);
      });
      if (cancelled) return;
      setMap(next);
      if (ids.size) {
        const { data: tagRows } = await supabase
          .from("tags")
          .select("id, label, color")
          .in("id", Array.from(ids));
        if (cancelled) return;
        const lookup: Record<string, TagOption> = {};
        (tagRows ?? []).forEach((t: any) => { lookup[t.id] = t; });
        setTagLookup(lookup);
      } else {
        setTagLookup({});
      }
    })();
    return () => { cancelled = true; };
  }, [contentTable, refreshKey]);

  return { tagsByContentId: map, tagLookup };
}
