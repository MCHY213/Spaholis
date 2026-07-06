import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, RotateCcw, Languages, Copy, Eraser, Eye, RefreshCw, ExternalLink } from "lucide-react";
import { content as defaults, seo as seoDefaults } from "@/data/content";
import { useSaveContent, setPreviewOverrides } from "@/hooks/useSiteContent";
import { supabase } from "@/integrations/supabase/client";
import { ImageUploadField } from "./ImageUploadField";
import { toast } from "sonner";

const IMAGE_KEY_PATTERNS = /^(.*image.*|.*img.*|.*logo.*|.*avatar.*|.*photo.*|.*thumbnail.*|.*banner.*|.*icon.*|.*background.*)$/i;

/* ============================================================
 * Raw fetch (bypasses merging done by useSiteContent)
 * ============================================================ */
function useRawSection<T>(key: string, fallback: T) {
  return useQuery({
    queryKey: ["site-content-raw", key],
    queryFn: async (): Promise<T> => {
      const { data } = await supabase
        .from("site_content")
        .select("content")
        .eq("section_key", key)
        .maybeSingle();
      // For ES rows, return empty object so missing keys = "fall back to EN"
      if (!data?.content) return key.endsWith("_es") ? ({} as T) : fallback;
      return data.content as T;
    },
    staleTime: 0,
  });
}

/* ============================================================
 * Path helpers
 * ============================================================ */
function setNestedValue(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  const result = obj == null ? {} : Array.isArray(obj) ? [...obj] : { ...obj };
  if (path.length === 1) {
    if (value === undefined || value === "") delete result[path[0]];
    else result[path[0]] = value;
    return result;
  }
  const [head, ...rest] = path;
  result[head] = setNestedValue(result[head], rest, value);
  return result;
}

function getNestedValue(obj: any, path: string[]): any {
  return path.reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

const TRANSLATABLE_KEY_HINT = /(title|subtitle|label|text|name|description|tagline|intent|eyebrow|note|message|copy|heading|body|caption|cta|placeholder|alt|hero|footer|content|tag|bio|role|question|answer|excerpt|item)/i;

function isImageValue(key: string, value: string) {
  return IMAGE_KEY_PATTERNS.test(key) || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|avif)/i.test(value);
}

function isUrlOrLink(key: string) {
  return /^(link|url|href|to)$/i.test(key);
}

/* ============================================================
 * Bilingual field renderer
 *
 * For each leaf:
 *   • text strings that look translatable  → side-by-side EN / ES inputs
 *   • image / link / number / boolean      → single English-only control
 *
 * EN values write to enRoot. ES values write to esRoot. Empty ES means
 * "fall back to English" thanks to the merge logic in useSiteContent.
 * ============================================================ */
function BilingualFields({
  enValue,
  esValue,
  path,
  onEnChange,
  onEsChange,
  labels,
}: {
  enValue: any;
  esValue: any;
  path: string[];
  onEnChange: (path: string[], value: any) => void;
  onEsChange: (path: string[], value: any) => void;
  labels?: Record<string, string>;
}) {
  if (enValue == null) return null;

  return (
    <>
      {Object.entries(enValue).map(([key, value]) => {
        const currentPath = [...path, key];
        const fieldId = currentPath.join(".");
        const label = labels?.[key] || key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
        const esVal = esValue?.[key];

        if (value == null) return null;

        /* ---------- strings ---------- */
        if (typeof value === "string") {
          if (isImageValue(key, value)) {
            return (
              <ImageUploadField
                key={fieldId}
                fieldId={fieldId}
                label={label}
                value={value}
                onChange={(val) => onEnChange(currentPath, val)}
              />
            );
          }

          // Non-translatable single-column field (URLs, anchors, internal keys)
          const translatable = TRANSLATABLE_KEY_HINT.test(key) && !isUrlOrLink(key);
          if (!translatable) {
            return (
              <div key={fieldId} className="space-y-1.5">
                <Label htmlFor={fieldId} className="text-sm font-medium">{label}</Label>
                <Input
                  id={fieldId}
                  value={value}
                  onChange={(e) => onEnChange(currentPath, e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            );
          }

          const isLong = value.length > 80 || (typeof esVal === "string" && esVal.length > 80);
          const Field = isLong ? Textarea : Input;

          return (
            <div key={fieldId} className="space-y-1.5">
              <Label htmlFor={fieldId} className="text-sm font-medium">{label}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">EN</span>
                  <Field
                    id={`${fieldId}.en`}
                    value={value}
                    rows={isLong ? 3 : undefined as any}
                    onChange={(e: any) => onEnChange(currentPath, e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Languages className="h-3 w-3" /> ES
                    <span className="text-muted-foreground font-normal normal-case ml-1">(blank = use English)</span>
                  </span>
                  <Field
                    id={`${fieldId}.es`}
                    value={typeof esVal === "string" ? esVal : ""}
                    rows={isLong ? 3 : undefined as any}
                    placeholder={value}
                    onChange={(e: any) => onEsChange(currentPath, e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          );
        }

        /* ---------- numbers / booleans (English only — no translation needed) ---------- */
        if (typeof value === "number") {
          return (
            <div key={fieldId} className="space-y-1.5">
              <Label htmlFor={fieldId} className="text-sm font-medium">{label}</Label>
              <Input
                id={fieldId}
                type="number"
                value={value}
                onChange={(e) => onEnChange(currentPath, parseFloat(e.target.value) || 0)}
                className="font-mono text-sm max-w-xs"
              />
            </div>
          );
        }

        if (typeof value === "boolean") {
          return (
            <div key={fieldId} className="flex items-center justify-between py-2">
              <Label htmlFor={fieldId} className="text-sm font-medium">{label}</Label>
              <Switch
                id={fieldId}
                checked={value}
                onCheckedChange={(checked) => onEnChange(currentPath, checked)}
              />
            </div>
          );
        }

        /* ---------- arrays ---------- */
        if (Array.isArray(value)) {
          if (value.length === 0) return null;

          if (typeof value[0] === "string") {
            const esArr: string[] = Array.isArray(esVal) ? (esVal as string[]) : [];
            return (
              <div key={fieldId} className="space-y-2">
                <Label className="text-sm font-medium">{label}</Label>
                {value.map((item: string, i: number) => (
                  <div key={`${fieldId}.${i}`} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">EN #{i + 1}</span>
                      <Input
                        value={item}
                        onChange={(e) => {
                          const newArr = [...value];
                          newArr[i] = e.target.value;
                          onEnChange(currentPath, newArr);
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                        <Languages className="h-3 w-3" /> ES #{i + 1}
                      </span>
                      <Input
                        value={esArr[i] ?? ""}
                        placeholder={item}
                        onChange={(e) => {
                          const newArr = [...esArr];
                          newArr[i] = e.target.value;
                          onEsChange(currentPath, newArr);
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          if (typeof value[0] === "object") {
            const esArr: any[] = Array.isArray(esVal) ? esVal : [];
            return (
              <div key={fieldId} className="space-y-3">
                <Label className="text-sm font-medium">{label}</Label>
                {value.map((item: any, i: number) => (
                  <Card key={`${fieldId}.${i}`} className="bg-muted/50">
                    <CardContent className="pt-4 space-y-3">
                      <BilingualFields
                        enValue={item}
                        esValue={esArr[i] ?? {}}
                        path={[...currentPath, String(i)]}
                        onEnChange={onEnChange}
                        onEsChange={onEsChange}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          }

          return null;
        }

        /* ---------- nested objects ---------- */
        if (typeof value === "object") {
          return (
            <div key={fieldId} className="space-y-3 pl-3 border-l-2 border-border">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
              <BilingualFields
                enValue={value}
                esValue={esVal && typeof esVal === "object" && !Array.isArray(esVal) ? esVal : {}}
                path={currentPath}
                onEnChange={onEnChange}
                onEsChange={onEsChange}
              />
            </div>
          );
        }

        return null;
      })}
    </>
  );
}

/* ============================================================
 * Main editor
 * ============================================================ */
export function AdminContentEditor() {
  const queryClient = useQueryClient();
  const enContentQ = useRawSection<any>("content", defaults);
  const esContentQ = useRawSection<any>("content_es", {});
  const enSeoQ = useRawSection<any>("seo", seoDefaults);
  const esSeoQ = useRawSection<any>("seo_es", {});
  const saveMutation = useSaveContent();

  const [editEnContent, setEditEnContent] = useState<any>({ ...defaults });
  const [editEsContent, setEditEsContent] = useState<any>({});
  const [editEnSeo, setEditEnSeo] = useState<any>({ ...seoDefaults });
  const [editEsSeo, setEditEsSeo] = useState<any>({});

  // ----- Live preview state -----
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<"en" | "es">("en");
  const [previewPath, setPreviewPath] = useState<string>("/");
  const [previewNonce, setPreviewNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Hydrate from DB once loaded
  useEffect(() => {
    if (enContentQ.data) {
      // Merge defaults under DB row so newly added keys appear in the editor
      setEditEnContent(deepMergeForEdit(defaults, enContentQ.data));
    }
  }, [enContentQ.data]);
  useEffect(() => {
    if (esContentQ.data) setEditEsContent(JSON.parse(JSON.stringify(esContentQ.data)));
  }, [esContentQ.data]);
  useEffect(() => {
    if (enSeoQ.data) setEditEnSeo(deepMergeForEdit(seoDefaults, enSeoQ.data));
  }, [enSeoQ.data]);
  useEffect(() => {
    if (esSeoQ.data) setEditEsSeo(JSON.parse(JSON.stringify(esSeoQ.data)));
  }, [esSeoQ.data]);

  const handleSave = async () => {
    try {
      await Promise.all([
        saveMutation.mutateAsync({ key: "content", value: editEnContent }),
        saveMutation.mutateAsync({ key: "content_es", value: pruneEmpty(editEsContent) }),
        saveMutation.mutateAsync({ key: "seo", value: editEnSeo }),
        saveMutation.mutateAsync({ key: "seo_es", value: pruneEmpty(editEsSeo) }),
      ]);
      queryClient.invalidateQueries({ queryKey: ["site-content-raw"] });
      toast.success("Content saved successfully (EN + ES)");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save content");
    }
  };

  const handleReset = () => {
    setEditEnContent(JSON.parse(JSON.stringify(defaults)));
    setEditEsContent({});
    setEditEnSeo(JSON.parse(JSON.stringify(seoDefaults)));
    setEditEsSeo({});
    toast.info("Reset to default values (click Save to persist)");
  };

  const handleAutofillEs = () => {
    const r1 = fillEsFromEn(editEnContent, editEsContent);
    const r2 = fillEsFromEn(editEnSeo, editEsSeo);
    setEditEsContent(r1.next);
    setEditEsSeo(r2.next);
    const total = r1.filled + r2.filled;
    if (total === 0) {
      toast.info("No empty Spanish fields to fill — everything already has a value.");
    } else {
      toast.success(`Filled ${total} empty Spanish field${total === 1 ? "" : "s"} from English. Click Save to persist.`);
    }
  };

  const handleClearEs = () => {
    if (!confirm("Clear ALL Spanish overrides? Spanish content will fall back to English everywhere until you save.")) {
      return;
    }
    setEditEsContent({});
    setEditEsSeo({});
    toast.info("All Spanish overrides cleared. Click Save to persist.");
  };

  /* ---------- Live preview ---------- */
  const writePreview = () => {
    setPreviewOverrides({
      content: editEnContent,
      content_es: pruneEmpty(editEsContent),
      seo: editEnSeo,
      seo_es: pruneEmpty(editEsSeo),
    });
  };

  const handleOpenPreview = () => {
    writePreview();
    setPreviewOpen(true);
  };

  const handleRefreshPreview = () => {
    writePreview();
    setPreviewNonce((n) => n + 1);
  };

  // Keep overrides in sync with edits while the preview sheet is open
  useEffect(() => {
    if (!previewOpen) return;
    writePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEnContent, editEsContent, editEnSeo, editEsSeo, previewOpen]);

  // Always clear staged preview overrides on unmount so the public site
  // doesn't keep rendering unsaved edits if the admin closes the tab.
  useEffect(() => {
    return () => setPreviewOverrides(null);
  }, []);

  const handleClosePreview = (open: boolean) => {
    setPreviewOpen(open);
    if (!open) setPreviewOverrides(null);
  };

  const previewSrc = (() => {
    const base =
      previewLang === "es"
        ? previewPath === "/"
          ? "/es"
          : `/es${previewPath}`
        : previewPath;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}__preview=${previewNonce}`;
  })();

  const previewablePages: { label: string; path: string }[] = [
    { label: "🏠 Home", path: "/" },
    { label: "ℹ️ About", path: "/about" },
    { label: "💆 Treatments", path: "/services" },
    { label: "🌟 Signature", path: "/signature-treatments" },
    { label: "📅 Classes", path: "/classes" },
    { label: "🔒 Private Sessions", path: "/private-sessions" },
    { label: "📅 Booking", path: "/booking" },
    { label: "📚 Education", path: "/education" },
    { label: "🎁 Gift Cards", path: "/gift-cards" },
    { label: "🏝️ Retreats", path: "/retreats" },
    { label: "🌿 Wellness", path: "/wellness" },
    { label: "❓ FAQs", path: "/faqs" },
  ];


  const sectionLabels: Record<string, string> = {
    nav: "🧭 Navigation Menu",
    hero: "🏠 Hero Section",
    wellness: "🧘 Wellness Section",
    signatureExperiences: "✨ Signature Experiences (Homepage)",
    movement: "🏃 Movement & Classes",
    testimonials: "⭐ Testimonials",
    cta: "📢 Call to Action",
    footer: "🔗 Footer",
    about: "ℹ️ About Page (Team, Images & Bio)",
    services: "💆 Treatments Page",
    signatureTreatments: "🌟 Signature Treatments Page",
    classes: "📅 Classes Page",
    privateSessions: "🔒 Private Sessions Page",
    giftCards: "🎁 Gift Cards Page",
    education: "📚 Education Page",
    whatsapp: "💬 WhatsApp Button",
  };

  const seoLabels: Record<string, string> = {
    home: "🏠 Home",
    about: "ℹ️ About",
    treatments: "💆 Treatments",
    signatureTreatments: "✨ Signature",
    classes: "🧘 Classes",
    privateSessions: "🔒 Private Sessions",
    booking: "📅 Booking",
    education: "📚 Education",
    giftCards: "🎁 Gift Cards",
    retreats: "🏝️ Retreats",
    wellness: "🌿 Wellness",
  };

  const isLoading =
    enContentQ.isLoading || esContentQ.isLoading || enSeoQ.isLoading || esSeoQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Content Editor</h2>
          <p className="text-sm text-muted-foreground">
            Edit website text in English and Spanish side-by-side. Leave Spanish blank to fall back to English.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleOpenPreview} title="Open a live preview using your unsaved EN/ES edits">
            <Eye className="h-4 w-4 mr-1" /> Live Preview
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutofillEs} title="Copy English values into any empty Spanish fields">
            <Copy className="h-4 w-4 mr-1" /> Auto-fill ES from EN
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearEs} title="Remove all Spanish overrides — falls back to English">
            <Eraser className="h-4 w-4 mr-1" /> Clear ES
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : (<><Save className="h-4 w-4 mr-1" /> Save Changes</>)}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading content…</p>
      ) : (
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Page Content</TabsTrigger>
            <TabsTrigger value="seo">SEO Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6 mt-4">
            {Object.entries(editEnContent).map(([section, value]) => (
              <Card key={section}>
                <CardHeader>
                  <CardTitle className="text-lg">{sectionLabels[section] || section}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <BilingualFields
                    enValue={value}
                    esValue={editEsContent?.[section] ?? {}}
                    path={[section]}
                    onEnChange={(p, v) => setEditEnContent((prev: any) => setNestedValue(prev, p, v))}
                    onEsChange={(p, v) => setEditEsContent((prev: any) => setNestedValue(prev, p, v))}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="seo" className="space-y-6 mt-4">
            {Object.entries(editEnSeo).map(([page, value]) => (
              <Card key={page}>
                <CardHeader>
                  <CardTitle className="text-lg">{seoLabels[page] || page}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <BilingualFields
                    enValue={value}
                    esValue={editEsSeo?.[page] ?? {}}
                    path={[page]}
                    onEnChange={(p, v) => setEditEnSeo((prev: any) => setNestedValue(prev, p, v))}
                    onEsChange={(p, v) => setEditEsSeo((prev: any) => setNestedValue(prev, p, v))}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}

      {/* Live preview drawer */}
      <Sheet open={previewOpen} onOpenChange={handleClosePreview}>
        <SheetContent side="right" className="w-full sm:max-w-[min(96vw,1200px)] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b space-y-2">
            <SheetTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Live Preview — unsaved edits
            </SheetTitle>
            <SheetDescription>
              Renders the selected page using your current draft. Nothing is saved until you click Save Changes.
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewLang("en")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    previewLang === "en" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang("es")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                    previewLang === "es" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  ES
                </button>
              </div>

              <Select value={previewPath} onValueChange={setPreviewPath}>
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {previewablePages.map((p) => (
                    <SelectItem key={p.path} value={p.path} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={handleRefreshPreview} className="h-8">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => window.open(previewSrc, "_blank", "noopener")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in tab
              </Button>
              <span className="text-[11px] text-muted-foreground ml-auto truncate max-w-[40%]" title={previewSrc}>
                {previewSrc}
              </span>
            </div>
          </SheetHeader>
          <div className="flex-1 bg-muted/30">
            <iframe
              ref={iframeRef}
              key={`${previewLang}:${previewPath}:${previewNonce}`}
              src={previewSrc}
              title="Site preview"
              className="w-full h-full border-0 bg-background"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ============================================================
 * Helpers: deepMergeForEdit (defaults under DB row, so the editor
 * always shows the full set of fields even if DB is partial), and
 * pruneEmpty (drop empty strings/objects from ES before saving).
 * ============================================================ */
function deepMergeForEdit(base: any, overlay: any): any {
  if (overlay == null) return JSON.parse(JSON.stringify(base));
  if (typeof base !== "object" || base === null) return overlay ?? base;
  if (Array.isArray(base)) return Array.isArray(overlay) ? overlay : base;
  const out: any = { ...base };
  for (const k of Object.keys(overlay)) {
    if (k in base && typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k])) {
      out[k] = deepMergeForEdit(base[k], overlay[k]);
    } else {
      out[k] = overlay[k];
    }
  }
  return out;
}

function pruneEmpty(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) {
    const arr = obj.map(pruneEmpty).filter((v) => !(v === "" || v == null));
    return arr;
  }
  if (typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const v = pruneEmpty(obj[k]);
      if (v === "" || v == null) continue;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = v;
    }
    return out;
  }
  return obj;
}

/**
 * Walk the EN tree and copy every translatable text leaf into the ES tree
 * IF the corresponding ES leaf is empty/missing. Skips images, URLs, links,
 * numbers, booleans, and any keys that don't look translatable. Returns the
 * new ES object plus the count of fields that were filled.
 */
function fillEsFromEn(en: any, es: any): { next: any; filled: number } {
  let filled = 0;

  function isTranslatableKey(k: string) {
    return TRANSLATABLE_KEY_HINT.test(k) && !isUrlOrLink(k);
  }

  function walk(enNode: any, esNode: any, parentKey: string): any {
    if (enNode == null) return esNode;

    if (typeof enNode === "string") {
      if (!isTranslatableKey(parentKey)) return esNode;
      if (isImageValue(parentKey, enNode)) return esNode;
      if (typeof esNode === "string" && esNode.trim() !== "") return esNode;
      filled++;
      return enNode;
    }

    if (Array.isArray(enNode)) {
      const esArr = Array.isArray(esNode) ? [...esNode] : [];
      const out = enNode.map((item, i) => walk(item, esArr[i], parentKey));
      return out;
    }

    if (typeof enNode === "object") {
      const base = esNode && typeof esNode === "object" && !Array.isArray(esNode) ? { ...esNode } : {};
      for (const k of Object.keys(enNode)) {
        base[k] = walk(enNode[k], base[k], k);
      }
      return base;
    }

    // numbers / booleans → never copied (English-only fields)
    return esNode;
  }

  const next = walk(en, es ?? {}, "");
  return { next, filled };
}
