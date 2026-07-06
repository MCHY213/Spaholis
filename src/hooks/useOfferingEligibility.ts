import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UserOffering } from "@/hooks/useOfferings";

/**
 * Eligibility links for an offering.
 * If an offering has NO rows in offering_eligible_classes, it works for ALL classes (universal).
 * If it has 1+ rows, it is restricted to that explicit set.
 */
export function useOfferingEligibilityMap() {
  return useQuery({
    queryKey: ["offering-eligibility-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offering_eligible_classes")
        .select("offering_id, class_id");
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      (data ?? []).forEach((row: any) => {
        if (!map[row.offering_id]) map[row.offering_id] = new Set();
        map[row.offering_id].add(row.class_id);
      });
      return map;
    },
    staleTime: 60_000,
  });
}

export function useOfferingEligibleClasses(offeringId: string | null | undefined) {
  return useQuery({
    queryKey: ["offering-eligible-classes", offeringId],
    queryFn: async () => {
      if (!offeringId) return [];
      const { data, error } = await supabase
        .from("offering_eligible_classes")
        .select("class_id")
        .eq("offering_id", offeringId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.class_id as string);
    },
    enabled: !!offeringId,
  });
}

export function useInvalidateEligibility() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["offering-eligibility-map"] });
    qc.invalidateQueries({ queryKey: ["offering-eligible-classes"] });
  };
}

/** Returns true if the user offering can be redeemed for the given class id. */
export function isOfferingEligibleForClass(
  offering: Pick<UserOffering, "offering_id">,
  classId: string,
  eligibilityMap: Record<string, Set<string>>,
): boolean {
  const set = eligibilityMap[offering.offering_id];
  if (!set || set.size === 0) return true; // universal
  return set.has(classId);
}

/** Filter a user's offerings to only those redeemable for the given class id. */
export function filterEligibleOfferings<T extends { offering_id: string }>(
  offerings: T[],
  classId: string,
  eligibilityMap: Record<string, Set<string>>,
): T[] {
  return offerings.filter((o) => isOfferingEligibleForClass(o, classId, eligibilityMap));
}
