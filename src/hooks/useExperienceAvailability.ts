import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExperienceSlot {
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

export function useExperienceSlots(serviceId: string | undefined) {
  return useQuery({
    queryKey: ["experience-availability", serviceId],
    enabled: !!serviceId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("experience_availability")
        .select("*")
        .eq("service_id", serviceId!)
        .eq("is_active", true)
        .gte("availability_date", today)
        .order("availability_date")
        .order("start_time");
      if (error) throw error;
      return data as ExperienceSlot[];
    },
  });
}

export function useBookExperience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      availability_id: string;
      guest_name: string;
      guest_email: string;
      guest_phone?: string;
      number_of_guests: number;
      total_price: number;
      notes?: string;
    }) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : undefined;
      const { error } = await supabase
        .from("experience_bookings")
        .insert({ id, ...payload } as any);
      if (error) throw error;
      return { id, ...payload };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experience-availability"] });
    },
  });
}
