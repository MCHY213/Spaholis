import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rowsToWeeklyHours, type WeeklyHours } from "@/lib/businessHours";

export interface BusinessHoursRow {
  weekday: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
  updated_at?: string;
}

/**
 * Fetches the weekly business-hours window from the `business_hours` table.
 * The result is a map keyed by weekday (0=Sunday..6=Saturday), suitable for
 * passing to `generateSpaSlotsForCalendarDate` and `checkBusinessHours`.
 *
 * Falls back to hardcoded defaults inside the businessHours helpers if the
 * network call fails, so the booking flow never breaks on a transient error.
 */
export function useBusinessHours() {
  return useQuery<WeeklyHours>({
    queryKey: ["business-hours"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("weekday, is_closed, open_time, close_time");
      if (error) throw error;
      return rowsToWeeklyHours((data ?? []) as BusinessHoursRow[]);
    },
  });
}

/** Raw rows for the admin editor (ordered Sun→Sat). */
export function useBusinessHoursRows() {
  return useQuery<BusinessHoursRow[]>({
    queryKey: ["business-hours", "rows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("weekday, is_closed, open_time, close_time, updated_at")
        .order("weekday", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BusinessHoursRow[];
    },
  });
}
