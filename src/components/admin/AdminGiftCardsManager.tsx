import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, Plus, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminGiftCardsManager() {
  const [cards, setCards] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCard, setNewCard] = useState({ code: "", initial_value: 50, recipient_name: "", recipient_email: "" });

  useEffect(() => { loadCards(); }, []);

  async function loadCards() {
    const { data } = await supabase.from("gift_cards").select("*").order("created_at", { ascending: false });
    setCards(data ?? []);
  }

  function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "HOLIS-";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function handleCreate() {
    const code = newCard.code || generateCode();
    const { error } = await supabase.from("gift_cards").insert({
      code,
      initial_value: newCard.initial_value,
      remaining_value: newCard.initial_value,
      recipient_name: newCard.recipient_name || null,
      recipient_email: newCard.recipient_email || null,
      is_active: true,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Gift card created");
    setCreateOpen(false);
    setNewCard({ code: "", initial_value: 50, recipient_name: "", recipient_email: "" });
    loadCards();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await supabase.from("gift_cards").update({ is_active: !isActive } as any).eq("id", id);
    loadCards();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-medium text-foreground">Gift Cards</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Gift Card</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Code", "Value", "Remaining", "Recipient", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cards.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-5 py-4 font-body text-sm font-mono font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    {c.code}
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-sm text-foreground">${c.initial_value}</td>
                <td className="px-5 py-4 font-body text-sm text-foreground">${c.remaining_value}</td>
                <td className="px-5 py-4 font-body text-sm text-muted-foreground">{c.recipient_name || c.recipient_email || "—"}</td>
                <td className="px-5 py-4">
                  <span className={cn(
                    "text-xs font-body font-semibold px-3 py-1 rounded-full",
                    c.is_active ? "bg-spa-sage/15 text-spa-sage" : "bg-muted text-muted-foreground"
                  )}>{c.is_active ? "Active" : "Inactive"}</span>
                </td>
                <td className="px-5 py-4">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(c.id, c.is_active)}>
                    {c.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Create Gift Card</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Code (auto-generated if empty)</label>
              <Input value={newCard.code} onChange={(e) => setNewCard({ ...newCard, code: e.target.value })} placeholder="HOLIS-XXXXXXXX" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Value ($)</label>
              <Input type="number" value={newCard.initial_value} onChange={(e) => setNewCard({ ...newCard, initial_value: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Recipient Name</label>
              <Input value={newCard.recipient_name} onChange={(e) => setNewCard({ ...newCard, recipient_name: e.target.value })} />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Recipient Email</label>
              <Input value={newCard.recipient_email} onChange={(e) => setNewCard({ ...newCard, recipient_email: e.target.value })} />
            </div>
            <Button onClick={handleCreate} className="w-full">Create Gift Card</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
