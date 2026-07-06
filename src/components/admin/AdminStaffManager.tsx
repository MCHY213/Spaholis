import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Staff {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function AdminStaffManager() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load staff");
      return;
    }
    setStaff(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(s: Staff) {
    setEditing(s);
    setName(s.name);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("staff")
        .update({ name: name.trim() })
        .eq("id", editing.id);
      if (error) {
        toast.error("Failed to update");
        return;
      }
      toast.success("Staff updated");
    } else {
      const { error } = await supabase
        .from("staff")
        .insert({ name: name.trim() });
      if (error) {
        toast.error("Failed to create");
        return;
      }
      toast.success("Staff added");
    }

    setDialogOpen(false);
    loadStaff();
  }

  async function toggleActive(s: Staff) {
    const { error } = await supabase
      .from("staff")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    loadStaff();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this staff member?")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete — staff may have existing bookings");
      return;
    }
    toast.success("Staff deleted");
    loadStaff();
  }

  if (loading) {
    return <div className="text-muted-foreground font-body text-sm">Loading staff...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-medium text-foreground">Staff / Rooms</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editing ? "Edit Staff" : "Add Staff"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="font-body text-sm">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria, Room A"
                  className="mt-1"
                />
              </div>
              <Button className="w-full" onClick={handleSave}>
                {editing ? "Save Changes" : "Add Staff"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Name", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4 font-body text-sm font-medium text-foreground">{s.name}</td>
                  <td className="px-5 py-4">
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                  </td>
                  <td className="px-5 py-4 font-body text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 flex items-center gap-2">
                    <button onClick={() => openEdit(s)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center font-body text-sm text-muted-foreground">
                    No staff members yet. Add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
