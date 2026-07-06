import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { content as defaults, seo as seoDefaults } from "@/data/content";
import { useLanguage } from "@/i18n/LanguageProvider";

type ContentType = typeof defaults;
type SeoType = typeof seoDefaults;

// Deep merge: overlay values on top of base. Empty strings/null/undefined in overlay are ignored
// so that a partially-filled Spanish translation falls back to the English base.
function deepMerge<T extends Record<string, any>>(base: T, overlay: Record<string, any>): T {
  const result = { ...base } as any;
  for (const key of Object.keys(overlay)) {
    const overlayVal = overlay[key];
    if (overlayVal === undefined || overlayVal === null) continue;
    if (typeof overlayVal === "string" && overlayVal.trim() === "") continue;
    if (
      key in base &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key]) &&
      base[key] !== null &&
      typeof overlayVal === "object" &&
      !Array.isArray(overlayVal)
    ) {
      result[key] = deepMerge(base[key], overlayVal);
    } else {
      result[key] = overlayVal;
    }
  }
  return result;
}

async function fetchSection(key: string) {
  const { data } = await supabase
    .from("site_content")
    .select("section_key, content")
    .eq("section_key", key)
    .maybeSingle();
  return (data?.content as Record<string, any>) || null;
}

/* ============================================================
 * Preview overrides
 * The Admin Content Editor can stage unsaved EN/ES content into
 * sessionStorage and open a live preview iframe. When that key is
 * present, we layer those overrides on top of whatever the DB has
 * so the editor user sees their staged edits live.
 * ============================================================ */
const PREVIEW_KEY = "__lovable_preview_overrides__";
const PREVIEW_EVENT = "lovable:preview-overrides-changed";

interface PreviewOverrides {
  content?: Record<string, any>;
  content_es?: Record<string, any>;
  seo?: Record<string, any>;
  seo_es?: Record<string, any>;
}

function readPreviewOverrides(): PreviewOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PreviewOverrides;
  } catch {
    return null;
  }
}

export function setPreviewOverrides(overrides: PreviewOverrides | null) {
  if (typeof window === "undefined") return;
  if (overrides == null) {
    window.sessionStorage.removeItem(PREVIEW_KEY);
  } else {
    window.sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(overrides));
  }
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT));
}

function usePreviewOverrides(): PreviewOverrides | null {
  // Lightweight subscription so consuming queries refetch when overrides change.
  // We reuse react-query's invalidation in the event listener below; the
  // hook itself just returns the current snapshot.
  return readPreviewOverrides();
}

// Wire a single global listener that invalidates content/seo queries when the
// preview overrides change. Safe to register multiple times — react-query
// handles the dedupe at the queryClient layer.
let __previewListenerAttached = false;
function ensurePreviewListener(queryClient: ReturnType<typeof useQueryClient>) {
  if (typeof window === "undefined" || __previewListenerAttached) return;
  __previewListenerAttached = true;
  window.addEventListener(PREVIEW_EVENT, () => {
    queryClient.invalidateQueries({ queryKey: ["site-content"] });
    queryClient.invalidateQueries({ queryKey: ["site-seo"] });
  });
}

export function useSiteContent() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  ensurePreviewListener(queryClient);
  const overrides = usePreviewOverrides();
  return useQuery({
    queryKey: ["site-content", language, overrides ? "preview" : "live"],
    queryFn: async (): Promise<ContentType> => {
      const en = overrides?.content ?? (await fetchSection("content"));
      let merged: Record<string, any> = en
        ? deepMerge(defaults as unknown as Record<string, any>, en)
        : { ...(defaults as unknown as Record<string, any>) };
      if (language === "es") {
        const es = overrides?.content_es ?? (await fetchSection("content_es"));
        if (es) merged = deepMerge(merged, es);
      }
      return merged as unknown as ContentType;
    },
    staleTime: overrides ? 0 : 1000 * 60 * 5,
  });
}

export function useSiteSeo() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  ensurePreviewListener(queryClient);
  const overrides = usePreviewOverrides();
  return useQuery({
    queryKey: ["site-seo", language, overrides ? "preview" : "live"],
    queryFn: async (): Promise<SeoType> => {
      const en = overrides?.seo ?? (await fetchSection("seo"));
      let merged: Record<string, any> = en
        ? deepMerge(seoDefaults as unknown as Record<string, any>, en)
        : { ...(seoDefaults as unknown as Record<string, any>) };
      if (language === "es") {
        const es = overrides?.seo_es ?? (await fetchSection("seo_es"));
        if (es) merged = deepMerge(merged, es);
      }
      return merged as unknown as SeoType;
    },
    staleTime: overrides ? 0 : 1000 * 60 * 5,
  });
}

export function useSaveContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("site_content")
        .upsert(
          { section_key: key, content: value, updated_at: new Date().toISOString() },
          { onConflict: "section_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
      queryClient.invalidateQueries({ queryKey: ["site-seo"] });
    },
  });
}
