import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageProvider";
import { localizeRow, localizeRows } from "@/lib/localizeRow";

const COLLECTION_I18N_FIELDS = ["title", "tagline", "intent"];
const SERVICE_I18N_FIELDS = ["title", "description"];
const CLASS_I18N_FIELDS = ["title", "description", "instructor"];
const RETREAT_I18N_FIELDS = ["title", "description"];

export interface CollectionRow {
  id: string;
  title: string;
  tagline: string | null;
  intent: string | null;
  image: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CollectionItemRow {
  id: string;
  collection_id: string;
  source_table: "services" | "classes" | "retreats";
  source_id: string;
  sort_order: number;
  tags: string[];
}

export interface ResolvedCollectionItem extends CollectionItemRow {
  title: string;
  description: string | null;
  category: string;
  type: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  instructor?: string | null;
}

export interface ResolvedCollection extends CollectionRow {
  items: ResolvedCollectionItem[];
}

// All available items from services, classes, retreats — for the admin picker
export interface AvailableItem {
  source_table: "services" | "classes" | "retreats";
  source_id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  instructor?: string | null;
}

export function useCollections() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["collections", language],
    queryFn: async (): Promise<ResolvedCollection[]> => {
      // Fetch collections
      const { data: collectionsRaw, error: cErr } = await supabase
        .from("collections")
        .select("*")
        .order("sort_order");
      if (cErr) throw cErr;
      const collections = localizeRows(collectionsRaw as any[], language, COLLECTION_I18N_FIELDS);

      // Fetch all collection items
      const { data: items, error: iErr } = await supabase
        .from("collection_items")
        .select("*")
        .order("sort_order");
      if (iErr) throw iErr;

      // Fetch source data — pull *_es columns too so we can localize
      const serviceIds = items?.filter(i => i.source_table === "services").map(i => i.source_id) || [];
      const classIds = items?.filter(i => i.source_table === "classes").map(i => i.source_id) || [];
      const retreatIds = items?.filter(i => i.source_table === "retreats").map(i => i.source_id) || [];

      const sourceMap = new Map<string, { title: string; description: string | null; category: string; type: string; duration_minutes: number; price: number; image_url: string | null; instructor?: string | null }>();

      if (serviceIds.length) {
        const { data } = await supabase
          .from("services")
          .select("id, title, title_es, description, description_es, category, type, duration_minutes, price, image_url")
          .in("id", serviceIds);
        localizeRows(data as any[], language, SERVICE_I18N_FIELDS).forEach((s: any) =>
          sourceMap.set(s.id, { ...s, type: s.type || "treatment" })
        );
      }
      if (classIds.length) {
        const { data } = await supabase
          .from("classes")
          .select("id, title, title_es, description, description_es, category, duration_minutes, price, image_url, instructor, instructor_es")
          .in("id", classIds);
        localizeRows(data as any[], language, CLASS_I18N_FIELDS).forEach((c: any) =>
          sourceMap.set(c.id, { ...c, type: "class" })
        );
      }
      if (retreatIds.length) {
        const { data } = await supabase
          .from("retreats")
          .select("id, title, title_es, description, description_es, type, duration_days, image_url")
          .in("id", retreatIds);
        localizeRows(data as any[], language, RETREAT_I18N_FIELDS).forEach((r: any) =>
          sourceMap.set(r.id, {
            title: r.title,
            description: r.description,
            category: "Retreats",
            type: r.type || "retreat",
            duration_minutes: (r.duration_days || 1) * 480,
            price: 0,
            image_url: r.image_url,
          })
        );
      }

      return (collections || []).map((col: any) => ({
        ...col,
        items: ((items || []) as CollectionItemRow[])
          .filter(i => i.collection_id === col.id)
          .map(i => {
            const src = sourceMap.get(i.source_id);
            return {
              ...i,
              title: src?.title || "Unknown",
              description: src?.description || null,
              category: src?.category || "",
              type: src?.type || "treatment",
              duration_minutes: src?.duration_minutes || 0,
              price: src?.price || 0,
              image_url: src?.image_url || null,
              instructor: src?.instructor || null,
            };
          }),
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAvailableItems() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["available-items", language],
    queryFn: async (): Promise<AvailableItem[]> => {
      const items: AvailableItem[] = [];

      const { data: services } = await supabase
        .from("services")
        .select("id, title, title_es, description, description_es, category, type, duration_minutes, price, image_url")
        .eq("is_active", true)
        .order("category")
        .order("sort_order");
      localizeRows(services as any[], language, SERVICE_I18N_FIELDS).forEach((s: any) =>
        items.push({ source_table: "services", source_id: s.id, ...s, type: s.type || "treatment" })
      );

      const { data: classes } = await supabase
        .from("classes")
        .select("id, title, title_es, description, description_es, category, duration_minutes, price, image_url, instructor, instructor_es")
        .eq("is_active", true)
        .order("title");
      localizeRows(classes as any[], language, CLASS_I18N_FIELDS).forEach((c: any) =>
        items.push({ source_table: "classes", source_id: c.id, ...c, type: "class" })
      );

      const { data: retreats } = await supabase
        .from("retreats")
        .select("id, title, title_es, description, description_es, type, duration_days, image_url")
        .eq("is_active", true)
        .order("sort_order");
      localizeRows(retreats as any[], language, RETREAT_I18N_FIELDS).forEach((r: any) =>
        items.push({
          source_table: "retreats",
          source_id: r.id,
          title: r.title,
          description: r.description,
          category: "Retreats",
          type: r.type || "retreat",
          duration_minutes: (r.duration_days || 1) * 480,
          price: 0,
          image_url: r.image_url,
        })
      );

      return items;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveCollectionItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, items }: { collectionId: string; items: { source_table: string; source_id: string; sort_order: number; tags: string[] }[] }) => {
      // Delete existing items for this collection, then insert new
      const { error: delErr } = await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", collectionId);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const { error: insErr } = await supabase
          .from("collection_items")
          .insert(items.map(i => ({ collection_id: collectionId, ...i })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection items saved!");
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useSaveCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (col: Partial<CollectionRow> & { id: string }) => {
      const { error } = await supabase
        .from("collections")
        .update({ title: col.title, tagline: col.tagline, intent: col.intent, image: col.image, sort_order: col.sort_order })
        .eq("id", col.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (col: { title: string; tagline?: string; intent?: string; image?: string }) => {
      const { error } = await supabase.from("collections").insert(col);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection created!");
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection deleted!");
    },
    onError: (err: any) => toast.error(err.message),
  });
}
