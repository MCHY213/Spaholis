import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageProvider";
import { localizeRow, localizeRows } from "@/lib/localizeRow";

export interface PricingTier {
  season: string;
  label: string;
  with_accommodation: { occupancy: string; price: number }[];
  without_accommodation: { occupancy: string; price: number }[];
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
}

export interface RetreatRow {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  type: string;
  duration_days: number;
  image_url: string | null;
  gallery_images: string[];
  pricing_tiers: PricingTier[];
  itinerary: ItineraryDay[];
  inclusions: string[];
  deposit_percentage: number;
  booking_policies: string | null;
  is_active: boolean;
  sort_order: number;
}

const RETREAT_I18N_FIELDS = [
  "title",
  "short_description",
  "description",
  "inclusions",
  "itinerary",
  "booking_policies",
];

export function useRetreats() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["retreats", language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retreats")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return localizeRows(data as any[], language, RETREAT_I18N_FIELDS) as unknown as RetreatRow[];
    },
  });
}

export function useRetreatBySlug(slug: string | undefined) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["retreat", slug, language],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retreats")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return localizeRow(data as any, language, RETREAT_I18N_FIELDS) as unknown as RetreatRow;
    },
  });
}
