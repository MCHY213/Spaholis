import { useState } from "react";
import { formatCRC } from "@/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface NewBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultDate?: string;
  defaultTime?: string;
  services: { id: string; title: string; category: string; type: string | null; duration_minutes: number; price: number }[];
}

export function NewBookingModal({ open, onOpenChange, onCreated, defaultDate, defaultTime, services }: NewBookingModalProps) {
  const [form, setForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    booking_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
    booking_time: defaultTime || "09:30",
    service_id: "",
    status: "confirmed",
    notes: "",
    total_price: "",
  });
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens with new defaults
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm((f) => ({
        ...f,
        booking_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
        booking_time: defaultTime || "09:30",
      }));
    }
    onOpenChange(isOpen);
  };

  const update = (key: string, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-fill price when service changes
      if (key === "service_id") {
        const svc = services.find((s) => s.id === value);
        if (svc) next.total_price = svc.price.toString();
      }
      return next;
    });
  };

  async function handleCreate() {
    if (!form.guest_name) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    const selectedService = services.find((s) => s.id === form.service_id);
    const { error } = await supabase.from("bookings").insert({
      guest_name: form.guest_name,
      guest_email: form.guest_email || null,
      guest_phone: form.guest_phone || null,
      booking_date: form.booking_date,
      booking_time: form.booking_time + ":00",
      service_id: form.service_id || null,
      status: form.status,
      notes: form.notes || null,
      total_price: form.total_price ? parseFloat(form.total_price) : selectedService?.price || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to create booking");
    } else {
      // Send email notification
      try {
        await supabase.functions.invoke("send-booking-notification", {
          body: {
            service_name: selectedService?.title || "Manual Booking",
            guest_name: form.guest_name,
            guest_email: form.guest_email || "Not provided",
            guest_phone: form.guest_phone || "Not provided",
            booking_date: form.booking_date,
            booking_time: form.booking_time,
            total_price: form.total_price || selectedService?.price || null,
            notes: form.notes || null,
          },
        });
      } catch {
        // notification failure is non-critical
      }
      toast.success("Booking created");
      setForm({ guest_name: "", guest_email: "", guest_phone: "", booking_date: format(new Date(), "yyyy-MM-dd"), booking_time: "09:30", service_id: "", status: "confirmed", notes: "", total_price: "" });
      onOpenChange(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">New Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Client Name *</Label>
            <Input value={form.guest_name} onChange={(e) => update("guest_name", e.target.value)} placeholder="Walk-in client, WhatsApp client..." className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={form.guest_email} onChange={(e) => update("guest_email", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.guest_phone} onChange={(e) => update("guest_phone", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Service</Label>
            <Select value={form.service_id} onValueChange={(v) => update("service_id", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title} — {formatCRC(s.price)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.booking_date} onChange={(e) => update("booking_date", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input type="time" value={form.booking_time} onChange={(e) => update("booking_time", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "confirmed", "paid", "completed"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price ($)</Label>
              <Input type="number" value={form.total_price} onChange={(e) => update("total_price", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Walk-in, WhatsApp request, special instructions..." className="min-h-[80px] text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
