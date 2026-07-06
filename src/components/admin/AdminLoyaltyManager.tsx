import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminLoyaltyManager() {
  const [settings, setSettings] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ visits_required: 10, discount_percentage: 15, is_active: true });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [s, r] = await Promise.all([
      supabase.from("loyalty_settings").select("*").limit(1).single(),
      supabase.from("loyalty_rewards").select("*").order("earned_at", { ascending: false }).limit(50),
    ]);
    if (s.data) {
      setSettings(s.data);
      setForm({ visits_required: s.data.visits_required, discount_percentage: s.data.discount_percentage, is_active: s.data.is_active });
    }
    setRewards(r.data ?? []);
  }

  async function handleSave() {
    if (settings) {
      const { error } = await supabase.from("loyalty_settings").update({
        visits_required: form.visits_required,
        discount_percentage: form.discount_percentage,
        is_active: form.is_active,
      }).eq("id", settings.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("loyalty_settings").insert({
        visits_required: form.visits_required,
        discount_percentage: form.discount_percentage,
        is_active: form.is_active,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Loyalty settings saved");
    setEditing(false);
    loadAll();
  }

  return (
    <div className="space-y-6">
      {/* Settings card */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg font-medium text-foreground">Loyalty Program Settings</h3>
          {!editing && <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Visits Required for Reward</label>
                <Input type="number" value={form.visits_required} onChange={(e) => setForm({ ...form, visits_required: Number(e.target.value) })} />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Discount Percentage</label>
                <Input type="number" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              <span className="font-body text-sm text-foreground">Program Active</span>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Visits Required</p>
              <p className="font-heading text-2xl text-foreground mt-1">{settings?.visits_required ?? "—"}</p>
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Discount</p>
              <p className="font-heading text-2xl text-foreground mt-1">{settings?.discount_percentage ?? "—"}%</p>
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Status</p>
              <span className={cn(
                "mt-2 inline-block text-xs font-body font-semibold px-3 py-1 rounded-full",
                settings?.is_active ? "bg-spa-sage/15 text-spa-sage" : "bg-muted text-muted-foreground"
              )}>{settings?.is_active ? "Active" : "Inactive"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rewards history */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-5 border-b border-border">
          <h3 className="font-heading text-lg font-medium text-foreground">Recent Rewards Issued</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["User", "Discount", "Earned", "Expires", "Used"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rewards.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4 font-body text-sm text-foreground font-mono">{r.user_id.slice(0, 8)}...</td>
                  <td className="px-5 py-4 font-body text-sm text-foreground">{r.discount_percentage}%</td>
                  <td className="px-5 py-4 font-body text-sm text-muted-foreground">{new Date(r.earned_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4 font-body text-sm text-muted-foreground">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      "text-xs font-body font-semibold px-3 py-1 rounded-full",
                      r.is_used ? "bg-muted text-muted-foreground" : "bg-spa-sage/15 text-spa-sage"
                    )}>{r.is_used ? "Used" : "Available"}</span>
                  </td>
                </tr>
              ))}
              {rewards.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center font-body text-sm text-muted-foreground">No rewards issued yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
