import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, X, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  forbidden_categories: string[];
  is_active: boolean;
}

const CATEGORY_OPTIONS = [
  "facial", "wrap", "massage", "body treatment", "scrub", "wellness", "energy work",
];

export function AdminRoomsManager() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editing, setEditing] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", forbidden_categories: [] as string[] });

  const load = async () => {
    const { data } = await supabase.from("rooms").select("*").order("name");
    setRooms((data as Room[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (r: Room) => {
    setEditing(r);
    setCreating(false);
    setForm({ name: r.name, forbidden_categories: r.forbidden_categories });
  };

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm({ name: "", forbidden_categories: [] });
  };

  const cancel = () => { setEditing(null); setCreating(false); };

  const toggleCategory = (cat: string) => {
    setForm((f) => ({
      ...f,
      forbidden_categories: f.forbidden_categories.includes(cat)
        ? f.forbidden_categories.filter((c) => c !== cat)
        : [...f.forbidden_categories, cat],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Room name is required"); return; }

    if (editing) {
      const { error } = await supabase
        .from("rooms")
        .update({ name: form.name, forbidden_categories: form.forbidden_categories } as any)
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Room updated");
    } else {
      const { error } = await supabase
        .from("rooms")
        .insert({ name: form.name, forbidden_categories: form.forbidden_categories } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Room created");
    }
    cancel();
    load();
  };

  const toggleActive = async (r: Room) => {
    const { error } = await supabase.from("rooms").update({ is_active: !r.is_active } as any).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(r.is_active ? "Room deactivated" : "Room activated");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-medium text-foreground">Rooms</h3>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Room
        </Button>
      </div>

      {(editing || creating) && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-base font-medium text-foreground">
              {editing ? "Edit Room" : "New Room"}
            </h4>
            <button onClick={cancel}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Room Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Room 1" />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-2 block">
              Forbidden Categories
            </label>
            <p className="font-body text-xs text-muted-foreground mb-2">
              Select treatment categories that cannot be performed in this room.
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-colors capitalize border",
                    form.forbidden_categories.includes(cat)
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save}>{editing ? "Update Room" : "Create Room"}</Button>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Room", "Forbidden Categories", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rooms.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-4 font-body text-sm font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-muted-foreground" />
                    {r.name}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {r.forbidden_categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {r.forbidden_categories.map((c) => (
                        <span key={c} className="text-[10px] font-body font-semibold uppercase bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">No restrictions</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className={cn(
                    "text-xs font-body font-semibold px-3 py-1 rounded-full",
                    r.is_active ? "bg-spa-sage/15 text-spa-sage" : "bg-muted text-muted-foreground"
                  )}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => startEdit(r)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toggleActive(r)}>
                      {r.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center font-body text-sm text-muted-foreground">No rooms configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
