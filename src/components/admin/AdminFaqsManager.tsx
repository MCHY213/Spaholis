import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, X, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";
import { RichTextEditor } from "./RichTextEditor";

interface Category {
  id: string;
  name: string;
  name_es: string | null;
  slug: string;
  description: string | null;
  description_es: string | null;
  sort_order: number;
  is_visible: boolean;
}

interface Faq {
  id: string;
  category_id: string | null;
  question: string;
  question_es: string | null;
  answer_html: string | null;
  answer_html_es: string | null;
  sort_order: number;
  is_visible: boolean;
  related_service_id: string | null;
  related_product_id: string | null;
}

interface ServiceLite { id: string; title: string; }
interface ProductLite { id: string; name: string; }

export function AdminFaqsManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [editingFaq, setEditingFaq] = useState<Partial<Faq> | null>(null);

  const load = useCallback(async () => {
    const [{ data: cats }, { data: f }, { data: srv }, { data: prd }] = await Promise.all([
      supabase.from("faq_categories" as any).select("*").order("sort_order"),
      supabase.from("faqs" as any).select("*").order("sort_order"),
      supabase.from("services").select("id, title").eq("is_active", true).order("title"),
      supabase.from("products").select("id, name").order("name"),
    ]);
    setCategories((cats as any) ?? []);
    setFaqs((f as any) ?? []);
    setServices((srv as any) ?? []);
    setProducts((prd as any) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Category handlers ──
  const saveCategory = async () => {
    if (!editingCat?.name) { toast.error("Name (EN) required"); return; }
    const payload = {
      name: editingCat.name,
      name_es: editingCat.name_es ?? editingCat.name,
      slug: editingCat.slug || slugify(editingCat.name),
      description: editingCat.description ?? null,
      description_es: editingCat.description_es ?? null,
      sort_order: editingCat.sort_order ?? categories.length,
      is_visible: editingCat.is_visible ?? true,
    };
    const { error } = editingCat.id
      ? await supabase.from("faq_categories" as any).update(payload).eq("id", editingCat.id)
      : await supabase.from("faq_categories" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Category saved");
    setEditingCat(null);
    load();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category? FAQs in it will be uncategorized.")) return;
    const { error } = await supabase.from("faq_categories" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const moveCategory = async (id: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === id);
    const swap = categories[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("faq_categories" as any).update({ sort_order: swap.sort_order }).eq("id", id),
      supabase.from("faq_categories" as any).update({ sort_order: categories[idx].sort_order }).eq("id", swap.id),
    ]);
    load();
  };

  const toggleCatVisible = async (c: Category) => {
    await supabase.from("faq_categories" as any).update({ is_visible: !c.is_visible }).eq("id", c.id);
    load();
  };

  // ── FAQ handlers ──
  const saveFaq = async () => {
    if (!editingFaq?.question) { toast.error("Question (EN) required"); return; }
    const inCat = faqs.filter((f) => f.category_id === editingFaq.category_id);
    const payload = {
      category_id: editingFaq.category_id ?? null,
      question: editingFaq.question,
      question_es: editingFaq.question_es ?? editingFaq.question,
      answer_html: editingFaq.answer_html ?? "",
      answer_html_es: editingFaq.answer_html_es ?? editingFaq.answer_html ?? "",
      sort_order: editingFaq.sort_order ?? inCat.length,
      is_visible: editingFaq.is_visible ?? true,
      related_service_id: editingFaq.related_service_id || null,
      related_product_id: editingFaq.related_product_id || null,
    };
    const { error } = editingFaq.id
      ? await supabase.from("faqs" as any).update(payload).eq("id", editingFaq.id)
      : await supabase.from("faqs" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("FAQ saved");
    setEditingFaq(null);
    load();
  };

  const deleteFaq = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    const { error } = await supabase.from("faqs" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const moveFaq = async (faq: Faq, dir: -1 | 1) => {
    const siblings = faqs.filter((f) => f.category_id === faq.category_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((f) => f.id === faq.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("faqs" as any).update({ sort_order: swap.sort_order }).eq("id", faq.id),
      supabase.from("faqs" as any).update({ sort_order: faq.sort_order }).eq("id", swap.id),
    ]);
    load();
  };

  const toggleFaqVisible = async (f: Faq) => {
    await supabase.from("faqs" as any).update({ is_visible: !f.is_visible }).eq("id", f.id);
    load();
  };

  // ── Render ──
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl text-foreground mb-1">FAQs</h2>
        <p className="text-sm text-muted-foreground font-body">
          Manage categories and questions shown on the public /faqs page.
        </p>
      </div>

      {/* Categories */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg text-foreground">Categories</h3>
          <Button size="sm" onClick={() => setEditingCat({ is_visible: true })}>
            <Plus className="h-4 w-4 mr-1" /> New category
          </Button>
        </div>
        <div className="space-y-2">
          {categories.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
              <div className="flex flex-col">
                <button onClick={() => moveCategory(c.id, -1)} disabled={i === 0} className="disabled:opacity-30">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button onClick={() => moveCategory(c.id, 1)} disabled={i === categories.length - 1} className="disabled:opacity-30">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1">
                <p className="font-body text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">/{c.slug} · {faqs.filter((f) => f.category_id === c.id).length} FAQs</p>
              </div>
              <button onClick={() => toggleCatVisible(c)} title={c.is_visible ? "Visible" : "Hidden"}>
                {c.is_visible ? <Eye className="h-4 w-4 text-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Button size="sm" variant="ghost" onClick={() => setEditingCat(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteCategory(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">No categories yet.</p>
          )}
        </div>
      </section>

      {/* FAQs */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg text-foreground">Questions</h3>
          <Button size="sm" onClick={() => setEditingFaq({ is_visible: true, category_id: categories[0]?.id })}>
            <Plus className="h-4 w-4 mr-1" /> New FAQ
          </Button>
        </div>

        {[
          ...categories.map((c) => ({ id: c.id, name: c.name })),
          { id: null as string | null, name: "General" },
        ].map((cat) => {
          const items = faqs
            .filter((f) => (f.category_id ?? null) === cat.id)
            .sort((a, b) => a.sort_order - b.sort_order);
          if (items.length === 0) return null;
          return (
            <div key={cat.id ?? "uncategorized"} className="mb-6">
              <h4 className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {cat.name}
                {cat.id === null && (
                  <span className="ml-2 normal-case tracking-normal text-[10px] text-muted-foreground/70">
                    (uncategorized)
                  </span>
                )}
              </h4>
              <div className="space-y-2">
                {items.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                    <div className="flex flex-col">
                      <button onClick={() => moveFaq(f, -1)} disabled={i === 0} className="disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveFaq(f, 1)} disabled={i === items.length - 1} className="disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="flex-1 font-body text-sm text-foreground truncate">{f.question}</p>
                    <button onClick={() => toggleFaqVisible(f)}>
                      {f.is_visible ? <Eye className="h-4 w-4 text-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingFaq(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteFaq(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Category modal */}
      {editingCat && (
        <Modal title={editingCat.id ? "Edit category" : "New category"} onClose={() => setEditingCat(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name (English)">
                <Input
                  value={editingCat.name ?? ""}
                  onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value, slug: editingCat.id ? editingCat.slug : slugify(e.target.value) })}
                />
              </Field>
              <Field label="Nombre (Español)">
                <Input
                  value={editingCat.name_es ?? ""}
                  placeholder="Falls back to English if empty"
                  onChange={(e) => setEditingCat({ ...editingCat, name_es: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Slug">
              <Input value={editingCat.slug ?? ""} onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Description (English, optional)">
                <Textarea value={editingCat.description ?? ""} onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })} />
              </Field>
              <Field label="Descripción (Español, opcional)">
                <Textarea
                  value={editingCat.description_es ?? ""}
                  placeholder="Falls back to English if empty"
                  onChange={(e) => setEditingCat({ ...editingCat, description_es: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-body">
              <Switch checked={editingCat.is_visible ?? true} onCheckedChange={(v) => setEditingCat({ ...editingCat, is_visible: v })} />
              Visible on public page
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setEditingCat(null)}>Cancel</Button>
            <Button onClick={saveCategory}>Save</Button>
          </div>
        </Modal>
      )}

      {/* FAQ modal */}
      {editingFaq && (
        <Modal title={editingFaq.id ? "Edit FAQ" : "New FAQ"} onClose={() => setEditingFaq(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Question (English)">
                <Input value={editingFaq.question ?? ""} onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })} />
              </Field>
              <Field label="Pregunta (Español)">
                <Input
                  value={editingFaq.question_es ?? ""}
                  placeholder="Falls back to English if empty"
                  onChange={(e) => setEditingFaq({ ...editingFaq, question_es: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Category">
              <Select
                value={editingFaq.category_id ?? "none"}
                onValueChange={(v) => setEditingFaq({ ...editingFaq, category_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Answer (English)">
              <RichTextEditor
                value={editingFaq.answer_html ?? ""}
                onChange={(html) => setEditingFaq({ ...editingFaq, answer_html: html })}
                placeholder="Write the answer..."
              />
            </Field>
            <Field label="Respuesta (Español)">
              <RichTextEditor
                value={editingFaq.answer_html_es ?? ""}
                onChange={(html) => setEditingFaq({ ...editingFaq, answer_html_es: html })}
                placeholder="Falls back to English if empty"
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Link to a service (optional)">
                <Select
                  value={editingFaq.related_service_id ?? "none"}
                  onValueChange={(v) => setEditingFaq({ ...editingFaq, related_service_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="No service" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No service</SelectItem>
                    {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Link to a product (optional)">
                <Select
                  value={editingFaq.related_product_id ?? "none"}
                  onValueChange={(v) => setEditingFaq({ ...editingFaq, related_product_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="No product" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No product</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-body">
              <Switch checked={editingFaq.is_visible ?? true} onCheckedChange={(v) => setEditingFaq({ ...editingFaq, is_visible: v })} />
              Visible on public page
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setEditingFaq(null)}>Cancel</Button>
            <Button onClick={saveFaq}>Save</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-body uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl my-8 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
