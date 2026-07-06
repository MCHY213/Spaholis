import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { wellnessCategories as defaults, type WellnessCategory } from "@/data/wellnessCategories";

export function useWellnessCategories() {
  return useQuery({
    queryKey: ["wellness-categories"],
    queryFn: async (): Promise<WellnessCategory[]> => {
      const { data } = await supabase
        .from("site_content")
        .select("content")
        .eq("section_key", "wellness_categories")
        .maybeSingle();

      if (data?.content && Array.isArray(data.content)) {
        return data.content as unknown as WellnessCategory[];
      }
      return defaults;
    },
    staleTime: 1000 * 60 * 5,
  });
}
