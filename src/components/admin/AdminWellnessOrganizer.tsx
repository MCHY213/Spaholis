import { useState, useMemo } from "react";
import { formatCRC, formatUsdRef } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GripVertical, Save, Plus, X, Settings2, Search, Filter, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCollections, useAvailableItems, useSaveCollectionItems, useSaveCollection,
  useCreateCollection, useDeleteCollection,
  type ResolvedCollection, type ResolvedCollectionItem, type AvailableItem,
} from "@/hooks/useCollections";

const TAG_OPTIONS = ["relax", "energy", "detox", "recovery", "transform", "glow", "strength", "flexibility", "mindfulness"];

const bookingTypeLabels: Record<string, string> = {
  treatment: "Treatment",
  class: "Class",
  retreat: "Retreat",
  experience: "Experience",
  program: "Program",
  private: "Private",
};

function BookingTypeBadge({ type }: { type: string }) {
  return (
    <span className="text-[10px] font-body font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
      {bookingTypeLabels[type] || type}
    </span>
  );
}

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:text-destructive">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// ─── Item Picker Modal ───
function ItemPicker({
  available,
  existingIds,
  onAdd,
  onClose,
}: {
  available: AvailableItem[];
  existingIds: Set<string>;
  onAdd: (item: AvailableItem, tags: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const types = useMemo(() => [...new Set(available.map(i => i.type))], [available]);
  const categories = useMemo(() => [...new Set(available.map(i => i.category))].sort(), [available]);

  const filtered = useMemo(() => {
    return available.filter(i => {
      if (existingIds.has(i.source_id)) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [available, existingIds, typeFilter, categoryFilter, search]);

  return (
    <div className="border border-border rounded-xl bg-card shadow-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-sm font-semibold">Add Items</h4>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-input bg-background px-2 py-1 text-xs" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {types.map(t => <option key={t} value={t}>{bookingTypeLabels[t] || t}</option>)}
        </select>
        <select className="rounded-lg border border-input bg-background px-2 py-1 text-xs" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="max-h-60 overflow-y-auto space-y-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No items match</p>}
        {filtered.map(item => (
          <div key={`${item.source_table}-${item.source_id}`} className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.category} · {item.duration_minutes}min · {formatCRC(item.price)}</p>
            </div>
            <BookingTypeBadge type={item.type} />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAdd(item, [])}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Collection Card ───
function CollectionCard({
  collection,
  allAvailable,
  onSaveItems,
  onSaveMeta,
  onDelete,
  savingItems,
}: {
  collection: ResolvedCollection;
  allAvailable: AvailableItem[];
  onSaveItems: (collectionId: string, items: { source_table: string; source_id: string; sort_order: number; tags: string[] }[]) => void;
  onSaveMeta: (col: ResolvedCollection) => void;
  onDelete: (id: string) => void;
  savingItems: boolean;
}) {
  const [items, setItems] = useState<ResolvedCollectionItem[]>(collection.items);
  const [dirty, setDirty] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [meta, setMeta] = useState({ title: collection.title, tagline: collection.tagline || "", intent: collection.intent || "", image: collection.image || "" });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [tagInput, setTagInput] = useState<{ idx: number; value: string } | null>(null);

  const existingIds = useMemo(() => new Set(items.map(i => i.source_id)), [items]);

  const handleAddItem = (item: AvailableItem, tags: string[]) => {
    const newItem: ResolvedCollectionItem = {
      id: crypto.randomUUID(),
      collection_id: collection.id,
      source_table: item.source_table,
      source_id: item.source_id,
      sort_order: items.length,
      tags,
      title: item.title,
      description: item.description,
      category: item.category,
      type: item.type,
      duration_minutes: item.duration_minutes,
      price: item.price,
      image_url: item.image_url,
      instructor: item.instructor,
    };
    setItems(prev => [...prev, newItem]);
    setDirty(true);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addTag = (idx: number, tag: string) => {
    if (!tag.trim()) return;
    setItems(prev => prev.map((item, i) =>
      i === idx && !item.tags.includes(tag.trim().toLowerCase())
        ? { ...item, tags: [...item.tags, tag.trim().toLowerCase()] }
        : item
    ));
    setDirty(true);
    setTagInput(null);
  };

  const removeTag = (idx: number, tag: string) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, tags: item.tags.filter(t => t !== tag) } : item
    ));
    setDirty(true);
  };

  // Drag & drop reorder within collection
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDirty(true);
    setDragIdx(null);
  };

  const handleSave = () => {
    onSaveItems(collection.id, items.map((item, i) => ({
      source_table: item.source_table,
      source_id: item.source_id,
      sort_order: i,
      tags: item.tags,
    })));
    setDirty(false);
  };

  const handleSaveMeta = () => {
    onSaveMeta({ ...collection, title: meta.title, tagline: meta.tagline, intent: meta.intent, image: meta.image });
    setEditingMeta(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">{collection.title}</h3>
            <p className="font-body text-xs text-muted-foreground">{items.length} items · {collection.tagline}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditingMeta(!editingMeta)}>
            <Settings2 className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowPicker(!showPicker)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={savingItems}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          )}
        </div>
      </div>

      {/* Meta editor */}
      {editingMeta && (
        <div className="p-4 border-b border-border bg-accent/5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Title</label>
              <Input value={meta.title} onChange={e => setMeta(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Tagline</label>
              <Input value={meta.tagline} onChange={e => setMeta(p => ({ ...p, tagline: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Intent</label>
            <Input value={meta.intent} onChange={e => setMeta(p => ({ ...p, intent: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Image URL</label>
            <Input value={meta.image} onChange={e => setMeta(p => ({ ...p, image: e.target.value }))} placeholder="https://..." />
            {meta.image && <img src={meta.image} alt="" className="mt-2 h-20 w-full object-cover rounded-lg" />}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveMeta}>Save Metadata</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this collection?")) onDelete(collection.id); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Item picker */}
      {showPicker && (
        <div className="p-4 border-b border-border">
          <ItemPicker available={allAvailable} existingIds={existingIds} onAdd={handleAddItem} onClose={() => setShowPicker(false)} />
        </div>
      )}

      {/* Items list */}
      {expanded && (
        <div className="divide-y divide-border min-h-[60px]">
          {items.length === 0 && (
            <p className="p-4 text-center font-body text-sm text-muted-foreground italic">No items yet — click Add to start</p>
          )}
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.stopPropagation(); handleDrop(idx); }}
              className={cn(
                "flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing",
                dragIdx === idx && "opacity-40"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-body text-sm font-medium text-foreground">{item.title}</p>
                  <BookingTypeBadge type={item.type} />
                </div>
                <p className="font-body text-xs text-muted-foreground mb-1.5">
                  {item.category} · {item.duration_minutes}min · {formatCRC(item.price)}
                  {item.instructor && ` · ${item.instructor}`}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {item.tags.map(tag => (
                    <TagBadge key={tag} tag={tag} onRemove={() => removeTag(idx, tag)} />
                  ))}
                  {tagInput?.idx === idx ? (
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-5 w-24 px-1.5 text-[10px] rounded"
                        placeholder="New tag…"
                        value={tagInput.value}
                        onChange={e => setTagInput({ idx, value: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") { addTag(idx, tagInput.value); } if (e.key === "Escape") setTagInput(null); }}
                        autoFocus
                        list={`tag-suggestions-${idx}`}
                      />
                      <datalist id={`tag-suggestions-${idx}`}>
                        {TAG_OPTIONS.filter(t => !item.tags.includes(t)).map(t => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                      <button onClick={() => addTag(idx, tagInput.value)} className="text-primary text-xs font-medium">Add</button>
                      <button onClick={() => setTagInput(null)} className="text-muted-foreground text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setTagInput({ idx, value: "" })} className="text-[10px] text-muted-foreground hover:text-foreground">
                      + tag
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => removeItem(idx)} className="p-1 hover:bg-destructive/10 rounded-lg shrink-0">
                <X className="h-3.5 w-3.5 text-destructive/60" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Organizer ───
export function AdminWellnessOrganizer() {
  const { data: collections, isLoading } = useCollections();
  const { data: available } = useAvailableItems();
  const saveItems = useSaveCollectionItems();
  const saveMeta = useSaveCollection();
  const createCol = useCreateCollection();
  const deleteCol = useDeleteCollection();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Filter state
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");

  const allTypes = useMemo(() => {
    if (!collections) return [];
    const types = new Set<string>();
    collections.forEach(c => c.items.forEach(i => types.add(i.type)));
    return [...types];
  }, [collections]);

  const allTags = useMemo(() => {
    if (!collections) return [];
    const tags = new Set<string>();
    collections.forEach(c => c.items.forEach(i => i.tags.forEach(t => tags.add(t))));
    return [...tags].sort();
  }, [collections]);

  if (isLoading) return <p className="text-muted-foreground p-8">Loading collections…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Collections</h2>
          <p className="text-sm text-muted-foreground">
            Organize services, classes & retreats into curated collections. Drag to reorder within a collection.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Collection
        </Button>
      </div>

      {/* Global filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All booking types</option>
          {allTypes.map(t => <option key={t} value={t}>{bookingTypeLabels[t] || t}</option>)}
        </select>
        <select className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="all">All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filterType !== "all" || filterTag !== "all") && (
          <button onClick={() => { setFilterType("all"); setFilterTag("all"); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Create collection */}
      {showCreate && (
        <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-xl border border-border">
          <Input className="flex-1" placeholder="Collection title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <Button size="sm" onClick={() => { createCol.mutate({ title: newTitle }); setNewTitle(""); setShowCreate(false); }}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
        </div>
      )}

      {/* Collection cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {collections?.map(col => {
          // Apply global filters to items shown
          const filteredItems = col.items.filter(item => {
            if (filterType !== "all" && item.type !== filterType) return false;
            if (filterTag !== "all" && !item.tags.includes(filterTag)) return false;
            return true;
          });
          const displayCol = { ...col, items: filterType === "all" && filterTag === "all" ? col.items : filteredItems };
          return (
            <CollectionCard
              key={col.id}
              collection={displayCol}
              allAvailable={available || []}
              onSaveItems={(cId, items) => saveItems.mutate({ collectionId: cId, items })}
              onSaveMeta={c => saveMeta.mutate(c)}
              onDelete={id => deleteCol.mutate(id)}
              savingItems={saveItems.isPending}
            />
          );
        })}
      </div>
    </div>
  );
}
