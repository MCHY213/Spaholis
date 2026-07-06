import { useState } from "react";
import { formatCRC, formatUsdRef } from "@/lib/currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServicesByType } from "@/hooks/useServices";
import { format, eachDayOfInterval, getDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Calendar, Users, CalendarPlus, Tag as TagIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { TagsInput } from "./TagsInput";
import { RelationshipsEditor } from "./RelationshipsEditor";

interface AvailabilityRow {
  id: string;
  service_id: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  booked_count: number;
  is_active: boolean;
  notes: string | null;
}

interface BookingRow {
  id: string;
  availability_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  number_of_guests: number;
  status: string;
  total_price: number | null;
  created_at: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminExperiencesManager() {
  const qc = useQueryClient();
  const { data: experiences } = useServicesByType("experience");
  const [selectedExp, setSelectedExp] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newSlot, setNewSlot] = useState({ date: "", start: "08:00", end: "16:00", capacity: 10, notes: "" });
  const [bulk, setBulk] = useState({ from: "", to: "", days: [1, 2, 3, 4, 5] as number[], start: "08:00", end: "16:00", capacity: 10, notes: "" });

  const { data: slots } = useQuery({
    queryKey: ["admin-exp-availability", selectedExp],
    enabled: !!selectedExp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("experience_availability")
        .select("*")
        .eq("service_id", selectedExp)
        .order("availability_date", { ascending: true })
        .order("start_time");
      if (error) throw error;
      return data as AvailabilityRow[];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-exp-bookings", selectedExp],
    enabled: !!selectedExp,
    queryFn: async () => {
      const slotIds = slots?.map((s) => s.id) ?? [];
      if (slotIds.length === 0) return [];
      const { data, error } = await supabase
        .from("experience_bookings")
        .select("*")
        .in("availability_id", slotIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BookingRow[];
    },
  });

  const addSlotMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("experience_availability").insert({
        service_id: selectedExp,
        availability_date: newSlot.date,
        start_time: newSlot.start,
        end_time: newSlot.end,
        max_capacity: newSlot.capacity,
        notes: newSlot.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Availability slot added");
      qc.invalidateQueries({ queryKey: ["admin-exp-availability"] });
      setShowAdd(false);
      setNewSlot({ date: "", start: "08:00", end: "16:00", capacity: 10, notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const dates = eachDayOfInterval({
        start: new Date(bulk.from + "T12:00"),
        end: new Date(bulk.to + "T12:00"),
      }).filter((d) => bulk.days.includes(getDay(d)));
      if (dates.length === 0) throw new Error("No matching days in the selected range");
      const rows = dates.map((d) => ({
        service_id: selectedExp,
        availability_date: format(d, "yyyy-MM-dd"),
        start_time: bulk.start,
        end_time: bulk.end,
        max_capacity: bulk.capacity,
        notes: bulk.notes || null,
      }));
      const { error } = await supabase.from("experience_availability").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} slots created`);
      qc.invalidateQueries({ queryKey: ["admin-exp-availability"] });
      setShowBulk(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSlotMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("experience_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot removed");
      qc.invalidateQueries({ queryKey: ["admin-exp-availability"] });
    },
  });

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const s = h >= 12 ? "PM" : "AM";
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, "0")} ${s}`;
  };

  const toggleDay = (day: number) => {
    setBulk((b) => ({
      ...b,
      days: b.days.includes(day) ? b.days.filter((d) => d !== day) : [...b.days, day],
    }));
  };

  const bulkPreviewCount = (() => {
    if (!bulk.from || !bulk.to) return 0;
    try {
      return eachDayOfInterval({
        start: new Date(bulk.from + "T12:00"),
        end: new Date(bulk.to + "T12:00"),
      }).filter((d) => bulk.days.includes(getDay(d))).length;
    } catch {
      return 0;
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-medium">Experience Availability</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <Select value={selectedExp} onValueChange={setSelectedExp}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select an experience" />
          </SelectTrigger>
          <SelectContent>
            {experiences.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedExp && (
          <div className="flex gap-2">
            <Button onClick={() => setShowAdd(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Date
            </Button>
            <Button onClick={() => setShowBulk(true)} size="sm" variant="outline">
              <CalendarPlus className="h-4 w-4 mr-1" /> Bulk Add
            </Button>
          </div>
        )}
      </div>

      {selectedExp && (
        <Tabs defaultValue="availability">
          <TabsList>
            <TabsTrigger value="availability"><Calendar className="h-3.5 w-3.5 mr-1" /> Availability</TabsTrigger>
            <TabsTrigger value="bookings"><Users className="h-3.5 w-3.5 mr-1" /> Bookings</TabsTrigger>
            <TabsTrigger value="cms"><TagIcon className="h-3.5 w-3.5 mr-1" /> Tags & Links</TabsTrigger>
          </TabsList>

          <TabsContent value="availability">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{format(new Date(s.availability_date + "T12:00"), "MMM d, yyyy")}</TableCell>
                    <TableCell>{formatTime(s.start_time)} – {formatTime(s.end_time)}</TableCell>
                    <TableCell>{s.max_capacity}</TableCell>
                    <TableCell>
                      <Badge variant={s.booked_count >= s.max_capacity ? "destructive" : "secondary"}>
                        {s.booked_count} / {s.max_capacity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.notes || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteSlotMut.mutate(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!slots || slots.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No availability slots yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="bookings">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Booked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.guest_name}</TableCell>
                    <TableCell>{b.guest_email}</TableCell>
                    <TableCell>{b.number_of_guests}</TableCell>
                    <TableCell><Badge variant={b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge></TableCell>
                    <TableCell>{formatCRC(b.total_price)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(b.created_at), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
                {(!bookings || bookings.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No bookings yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="cms">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
              <div className="rounded-xl border border-border p-4 space-y-3">
                <h4 className="font-heading text-sm font-medium text-foreground flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-muted-foreground" /> Tags
                </h4>
                <TagsInput contentTable="services" contentId={selectedExp} />
                <p className="text-[11px] text-muted-foreground">
                  Tags applied here also show on the experience throughout the site.
                </p>
              </div>

              <RelationshipsEditor
                sourceTable="services"
                sourceId={selectedExp}
                targetTable="products"
                relationType="related"
                title="Linked products"
              />

              <RelationshipsEditor
                sourceTable="services"
                sourceId={selectedExp}
                targetTable="retreats"
                relationType="related"
                title="Linked retreats"
              />

              <RelationshipsEditor
                sourceTable="services"
                sourceId={selectedExp}
                targetTable="blog_posts"
                relationType="related"
                title="Related articles"
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Single slot dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Availability Slot</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-body mb-1 block">Date</label>
              <Input type="date" value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-body mb-1 block">Start Time</label>
                <Input type="time" value={newSlot.start} onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-body mb-1 block">End Time</label>
                <Input type="time" value={newSlot.end} onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-body mb-1 block">Max Capacity</label>
              <Input type="number" min={1} value={newSlot.capacity} onChange={(e) => setNewSlot({ ...newSlot, capacity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-body mb-1 block">Notes (optional)</label>
              <Input value={newSlot.notes} onChange={(e) => setNewSlot({ ...newSlot, notes: e.target.value })} placeholder="e.g. Includes lunch" />
            </div>
            <Button onClick={() => addSlotMut.mutate()} disabled={!newSlot.date || addSlotMut.isPending} className="w-full">
              {addSlotMut.isPending ? "Adding…" : "Add Slot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk add dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Add Recurring Slots</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-body mb-1 block">From Date</label>
                <Input type="date" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-body mb-1 block">To Date</label>
                <Input type="date" value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-sm font-body mb-1 block">Days of Week</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      bulk.days.includes(i)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-body mb-1 block">Start Time</label>
                <Input type="time" value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-body mb-1 block">End Time</label>
                <Input type="time" value={bulk.end} onChange={(e) => setBulk({ ...bulk, end: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-sm font-body mb-1 block">Max Capacity per Slot</label>
              <Input type="number" min={1} value={bulk.capacity} onChange={(e) => setBulk({ ...bulk, capacity: Number(e.target.value) })} />
            </div>

            <div>
              <label className="text-sm font-body mb-1 block">Notes (optional)</label>
              <Input value={bulk.notes} onChange={(e) => setBulk({ ...bulk, notes: e.target.value })} placeholder="e.g. Morning group" />
            </div>

            {bulkPreviewCount > 0 && (
              <p className="text-sm text-muted-foreground">
                This will create <span className="font-semibold text-foreground">{bulkPreviewCount}</span> availability slot{bulkPreviewCount !== 1 ? "s" : ""}.
              </p>
            )}

            <Button
              onClick={() => bulkMut.mutate()}
              disabled={!bulk.from || !bulk.to || bulk.days.length === 0 || bulkMut.isPending}
              className="w-full"
            >
              {bulkMut.isPending ? "Creating…" : `Create ${bulkPreviewCount} Slot${bulkPreviewCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
