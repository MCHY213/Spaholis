import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FaqCategory {
  id: string;
  name: string;
  name_es: string | null;
  slug: string;
  description: string | null;
  description_es: string | null;
  sort_order: number;
  is_visible: boolean;
}

export interface Faq {
  id: string;
  category_id: string | null;
  question: string;
  question_es: string | null;
  answer_html: string | null;
  answer_html_es: string | null;
  answer: any;
  answer_es: any;
  sort_order: number;
  is_visible: boolean;
  related_service_id: string | null;
  related_product_id: string | null;
}

export function useFaqCategories() {
  return useQuery({
    queryKey: ["faq_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_categories" as any)
        .select("*")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FaqCategory[];
    },
  });
}

export function useFaqs() {
  return useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faqs" as any)
        .select("*")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Faq[];
    },
  });
}
