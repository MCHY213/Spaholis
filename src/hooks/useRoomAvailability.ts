import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  generateSpaSlotsForCalendarDate,
  getBusinessHours,
  spaLocalParts,
  spaLocalToInstant,
} from "@/lib/businessHours";
import { useBusinessHours } from "@/hooks/useBusinessHours";

export interface TimeSlot {
  time: Date;
  label: string;
  room: { id: string; name: string };
}

function formatSlotLabel(d: Date): string {
  // Slot instants are UTC times whose local wall clock IS the spa wall
  // clock — render in the spa timezone so the label matches what the
  // backend will validate against, regardless of the browser's tz.
  const { hour, minute } = spaLocalParts(d);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

interface Room {
  id: string;
  name: string;
  forbidden_categories: string[];
}

export function useRoomAvailability(
  date: Date | undefined,
  serviceCategory: string | undefined,
  durationMinutes: number | undefined
) {
  const { data: weeklyHours } = useBusinessHours();
  return useQuery({
    queryKey: ["room-availability", date?.toISOString(), serviceCategory, durationMinutes, weeklyHours],
    enabled: !!date && !!serviceCategory && !!durationMinutes && !!weeklyHours,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!date || !serviceCategory || !durationMinutes) return [];

      // 1. Get rooms
      const { data: rooms, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_active", true);
      if (roomErr) throw roomErr;

      // 2. Filter rooms by category rules
      const validRooms = (rooms as Room[]).filter(
        (r) => !r.forbidden_categories.includes(serviceCategory.toLowerCase())
      );

      if (validRooms.length === 0) return [];

      // 3. Get bookings for this date, using SPA-local open/close instants
      //    so we don't miss late bookings that live "on the next day" in UTC.
      const y = date.getFullYear();
      const m0 = date.getMonth();
      const d = date.getDate();
      const weekday = new Date(Date.UTC(y, m0, d)).getUTCDay();
      const bh = getBusinessHours(weekday, weeklyHours);
      if (bh.isClosed) return [];
      const dayStart = spaLocalToInstant(y, m0, d, bh.startHour, bh.startMinute);
      const dayEnd = spaLocalToInstant(y, m0, d, bh.endHour, bh.endMinute);

      const { data: bookings, error: bookErr } = await supabase
        .from("bookings")
        .select("room_id, start_time, end_time")
        .not("status", "eq", "cancelled")
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEnd.toISOString());
      if (bookErr) throw bookErr;

      // 4. Generate slots per room, filtering conflicts. The shared spa
      //    slot generator produces the EXACT same list the backend will
      //    accept — same tz, same window, same 30-min interval, same
      //    same-day 15-min lead time.
      const slots = generateSpaSlotsForCalendarDate(date, durationMinutes, new Date(), weeklyHours);
      const results: TimeSlot[] = [];

      for (const room of validRooms) {
        const roomBookings = (bookings ?? []).filter((b: any) => b.room_id === room.id);
        for (const slot of slots) {
          const slotEnd = new Date(slot.getTime() + durationMinutes * 60000);
          const hasConflict = roomBookings.some((b: any) => {
            const bStart = new Date(b.start_time);
            const bEnd = new Date(b.end_time);
            return slot < bEnd && slotEnd > bStart;
          });
          if (!hasConflict) {
            results.push({
              time: slot,
              label: formatSlotLabel(slot),
              room: { id: room.id, name: room.name },
            });
          }
        }
      }

      // Sort by time, then room name
      results.sort((a, b) => a.time.getTime() - b.time.getTime() || a.room.name.localeCompare(b.room.name));
      return results;
    },
  });
}
