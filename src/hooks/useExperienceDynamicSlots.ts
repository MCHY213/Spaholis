import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  generateSpaSlotsForCalendarDate,
  spaLocalParts,
} from "@/lib/businessHours";
import { useBusinessHours } from "@/hooks/useBusinessHours";

export interface DynamicExpSlot {
  time: Date;
  label: string;
  availabilityId: string | null;  // existing record, or null if needs creation
  spotsLeft: number;
  maxCapacity: number;
  full: boolean;
}

function formatLabel(d: Date): string {
  const { hour, minute } = spaLocalParts(d);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}


/**
 * Generate dynamic time slots for an experience on a given date,
 * checking existing bookings to compute remaining capacity.
 */
export function useExperienceDynamicSlots(
  serviceId: string | undefined,
  date: Date | undefined,
  durationMinutes: number | undefined,
  defaultCapacity: number
) {
  const { data: weeklyHours } = useBusinessHours();
  return useQuery<DynamicExpSlot[]>({
    queryKey: ["exp-dynamic-slots", serviceId, date?.toISOString(), durationMinutes, weeklyHours],
    enabled: !!serviceId && !!date && !!durationMinutes && !!weeklyHours,
    queryFn: async () => {
      if (!serviceId || !date || !durationMinutes) return [];

      const dateStr = format(date, "yyyy-MM-dd");

      // Get existing availability records for this service+date
      const { data: avails } = await supabase
        .from("experience_availability")
        .select("*")
        .eq("service_id", serviceId)
        .eq("availability_date", dateStr)
        .eq("is_active", true);

      // Get all bookings for this service on this date (via availability)
      const { data: allAvails } = await supabase
        .from("experience_availability")
        .select("id, start_time, max_capacity, booked_count")
        .eq("service_id", serviceId)
        .eq("availability_date", dateStr);

      const availMap = new Map<string, { id: string; max_capacity: number; booked_count: number }>();
      for (const a of allAvails ?? []) {
        availMap.set(a.start_time, a);
      }

      // Generate dynamic time slots in the SPA timezone so the labels and
      // instants match what create-booking will validate against.
      const timeSlots = generateSpaSlotsForCalendarDate(date, durationMinutes, new Date(), weeklyHours);

      return timeSlots.map((t) => {
        const p = spaLocalParts(t);
        const timeStr = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:00`;
        const existing = availMap.get(timeStr) || availMap.get(timeStr.slice(0, 5));
        const maxCap = existing?.max_capacity ?? defaultCapacity;
        const booked = existing?.booked_count ?? 0;
        const spotsLeft = Math.max(0, maxCap - booked);

        return {
          time: t,
          label: formatLabel(t),
          availabilityId: existing?.id ?? null,
          spotsLeft,
          maxCapacity: maxCap,
          full: spotsLeft <= 0,
        };
      });
    },
  });
}

/**
 * Get or create an experience_availability record for a specific slot.
 */
export async function ensureAvailabilityRecord(
  serviceId: string,
  date: Date,
  startTime: string,
  durationMinutes: number,
  defaultCapacity: number
): Promise<string> {
  const dateStr = format(date, "yyyy-MM-dd");
  // Pure minute arithmetic on the "HH:mm" string keeps this timezone-free —
  // start_time / end_time are stored as spa-local wall clocks by convention.
  const [h, m] = startTime.split(":").map(Number);
  const totalMin = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  // Check if record exists
  const { data: existing } = await supabase
    .from("experience_availability")
    .select("id")
    .eq("service_id", serviceId)
    .eq("availability_date", dateStr)
    .eq("start_time", startTime)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new
  const { data: created, error } = await supabase
    .from("experience_availability")
    .insert({
      service_id: serviceId,
      availability_date: dateStr,
      start_time: startTime,
      end_time: endTime,
      max_capacity: defaultCapacity,
    })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}
