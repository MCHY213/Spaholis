import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Trash2, Plus, X, Copy, Search, ExternalLink, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";
import { RichTextEditor } from "./RichTextEditor";
import { MediaPickerDialog } from "./MediaLibrary";
import { GalleryEditor } from "./GalleryEditor";
import { TagsInput } from "./TagsInput";
import { TagFilter, useContentTagMap } from "./TagFilter";
import { RelationshipsEditor } from "./RelationshipsEditor";

interface BlogRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: { html?: string } | any;
  cover_image: string | null;
  gallery_images: string[] | any;
  author: string | null;
  tags: string[] | null;
  publish_date: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  featured: boolean;
  sort_order: number;
}

const empty: Omit<BlogRow, "id"> = {
  title: "",
  slug: "",
  excerpt: "",
  content: { html: "" },
  cover_image: null,
  gallery_images: [],
  author: "Holis Wellness Center",
  tags: [],
  publish_date: null,
  seo_title: "",
  seo_description: "",
  status: "draft",
  featured: false,
  sort_order: 0,
};

export function AdminBlogManager() {
  const [posts, setPosts] = useState<BlogRow[]>([]);
  const [editing, setEditing] = useState<BlogRow | (Omit<BlogRow, "id"> & { id?: string }) | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pickerOpen, setPickerOpen] = useState<null | "cover" | "rt">(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagRefresh, setTagRefresh] = useState(0);
  const { tagsByContentId, tagLookup } = useContentTagMap("blog_posts", tagRefresh);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPosts((data as any) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-slug
  useEffect(() => {
    if (!editing) return;
    if ("id" in editing && editing.id) return; // don't autoslug on existing
    if (slugTouched) return;
    const auto = slugify(editing.title || "");
    if (auto && auto !== editing.slug) setEditing({ ...editing, slug: auto });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.title]);

  const startNew = () => {
    setSlugTouched(false);
    setEditing({ ...empty });
  };

  const startEdit = (p: BlogRow) => {
    setSlugTouched(true);
    setEditing(p);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("Title is required"); return; }
    if (!editing.slug.trim()) { toast.error("Slug is required"); return; }

    const payload = {
      title: editing.title.trim(),
      slug: slugify(editing.slug),
      excerpt: editing.excerpt,
      content: editing.content || { html: "" },
      cover_image: editing.cover_image,
      gallery_images: editing.gallery_images || [],
      author: editing.author,
      tags: editing.tags || [],
      publish_date: editing.publish_date,
      seo_title: editing.seo_title,
      seo_description: editing.seo_description,
      status: editing.status,
      featured: editing.featured,
      sort_order: editing.sort_order,
    };

    if ("id" in editing && editing.id) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Post updated");
      setEditing(null);
      setTagRefresh((n) => n + 1);
      load();
    } else {
      const { data, error } = await supabase.from("blog_posts").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      toast.success("Post created");
      // Re-open in edit mode so tags & relationships can be configured
      if (data) { setEditing(data as BlogRow); setSlugTouched(true); load(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const handleDuplicate = async (p: BlogRow) => {
    const newSlug = `${p.slug}-copy-${Date.now().toString(36).slice(-4)}`;
    const { id, ...rest } = p;
    const { error } = await supabase.from("blog_posts").insert({
      ...rest,
      title: `${p.title} (Copy)`,
      slug: newSlug,
      status: "draft",
      featured: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Duplicated");
    load();
  };

  const togglePublish = async (p: BlogRow) => {
    const newStatus = p.status === "published" ? "draft" : "published";
    const update: any = { status: newStatus };
    if (newStatus === "published" && !p.publish_date) update.publish_date = new Date().toISOString();
    const { error } = await supabase.from("blog_posts").update(update).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "published" ? "Published" : "Unpublished");
    load();
  };

  const filtered = posts.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.title.toLowerCase().includes(s) && !p.slug.toLowerCase().includes(s)) return false;
    }
    if (tagFilter.length) {
      const rowTags = tagsByContentId[p.id] ?? [];
      if (!tagFilter.every((t) => rowTags.includes(t))) return false;
    }
    return true;
  });

  // ---------- EDIT VIEW ----------
  if (editing) {
    const isNew = !("id" in editing && editing.id);
    return (
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-foreground">{isNew ? "New Post" : "Edit Post"}</h3>
          <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: main fields */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Title *</label>
              <Input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Post title"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Slug *</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">/blog/</span>
                <Input
                  value={editing.slug}
                  onChange={(e) => { setSlugTouched(true); setEditing({ ...editing, slug: e.target.value }); }}
                  placeholder="auto-generated-from-title"
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ ...editing, slug: slugify(editing.title) })}>
                  Regen
                </Button>
              </div>
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Excerpt</label>
              <Textarea
                value={editing.excerpt ?? ""}
                onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                placeholder="Short summary shown on the blog index"
                rows={3}
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Content</label>
              <RichTextEditor
                value={(editing.content as any)?.html ?? ""}
                onChange={(html) => setEditing({ ...editing, content: { ...(editing.content || {}), html, type: "doc" } })}
                placeholder="Write your article..."
                onImageRequest={() => new Promise((resolve) => {
                  // open picker, return picked URL
                  const handler = (url: string) => resolve(url);
                  (window as any).__rtImageResolve = handler;
                  setPickerOpen("rt");
                })}
              />
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="space-y-5">
            <div className="rounded-xl border border-border p-4 space-y-4">
              <h4 className="font-heading text-sm font-medium text-foreground">Publish</h4>
              <div>
                <label className="font-body text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="font-body text-sm text-foreground">Featured</label>
                <Switch
                  checked={editing.featured}
                  onCheckedChange={(v) => setEditing({ ...editing, featured: v })}
                />
              </div>
              <div>
                <label className="font-body text-xs font-medium text-muted-foreground mb-1 block">Publish date</label>
                <Input
                  type="datetime-local"
                  value={editing.publish_date ? editing.publish_date.slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, publish_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div>
                <label className="font-body text-xs font-medium text-muted-foreground mb-1 block">Sort order</label>
                <Input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="font-heading text-sm font-medium text-foreground">Cover image</h4>
              {editing.cover_image ? (
                <div className="relative">
                  <img src={editing.cover_image} alt="" className="w-full aspect-video object-cover rounded-lg" />
                  <button
                    onClick={() => setEditing({ ...editing, cover_image: null })}
                    className="absolute top-2 right-2 p-1 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-muted/40 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen("cover")}>
                Choose from Media Library
              </Button>
            </div>

            <GalleryEditor
              images={(editing.gallery_images as string[]) ?? []}
              onChange={(imgs) => setEditing({ ...editing, gallery_images: imgs })}
            />

            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="font-heading text-sm font-medium text-foreground">Author</h4>
              <Input
                value={editing.author ?? ""}
                onChange={(e) => setEditing({ ...editing, author: e.target.value })}
              />
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="font-heading text-sm font-medium text-foreground">Tags</h4>
              <TagsInput contentTable="blog_posts" contentId={"id" in editing ? editing.id : undefined} />
            </div>

            <RelationshipsEditor
              sourceTable="blog_posts"
              sourceId={"id" in editing ? editing.id : undefined}
              targetTable="services"
              relationType="related"
              title="Related services"
            />

            <RelationshipsEditor
              sourceTable="blog_posts"
              sourceId={"id" in editing ? editing.id : undefined}
              targetTable="products"
              relationType="related"
              title="Related products"
            />

            <RelationshipsEditor
              sourceTable="blog_posts"
              sourceId={"id" in editing ? editing.id : undefined}
              targetTable="retreats"
              relationType="related"
              title="Related retreats"
            />

            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="font-heading text-sm font-medium text-foreground">SEO</h4>
              <div>
                <label className="font-body text-xs font-medium text-muted-foreground mb-1 block">SEO title</label>
                <Input
                  value={editing.seo_title ?? ""}
                  onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
                  placeholder={editing.title}
                  maxLength={60}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{(editing.seo_title ?? "").length}/60</p>
              </div>
              <div>
                <label className="font-body text-xs font-medium text-muted-foreground mb-1 block">SEO description</label>
                <Textarea
                  value={editing.seo_description ?? ""}
                  onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })}
                  placeholder={editing.excerpt ?? ""}
                  maxLength={160}
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{(editing.seo_description ?? "").length}/160</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-border">
          <Button onClick={handleSave}>Save</Button>
          <Button variant="ghost" onClick={() => { setEditing(null); setTagRefresh((n) => n + 1); load(); }}>Close</Button>
        </div>

        <MediaPickerDialog
          open={pickerOpen !== null}
          onOpenChange={(v) => { if (!v) setPickerOpen(null); }}
          onSelect={(url) => {
            if (pickerOpen === "cover") setEditing({ ...editing, cover_image: url });
            else if (pickerOpen === "rt") {
              const fn = (window as any).__rtImageResolve;
              if (fn) { fn(url); (window as any).__rtImageResolve = null; }
            }
            setPickerOpen(null);
          }}
        />
      </div>
    );
  }

  // ---------- TABLE VIEW ----------
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-medium text-foreground">Blog Posts</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 h-9 w-48"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-body"
            >
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <TagFilter contentTable="blog_posts" value={tagFilter} onChange={setTagFilter} />
            <Button size="sm" onClick={startNew}>
              <Plus className="h-4 w-4 mr-1" /> New Post
            </Button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
              {p.cover_image ? (
                <img src={p.cover_image} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-20 h-14 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-body text-sm font-medium text-foreground truncate">{p.title}</p>
                  {p.featured && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">★ Featured</span>}
                </div>
                <p className="font-body text-xs text-muted-foreground truncate">/{p.slug} · {p.author ?? "—"}</p>
                {(tagsByContentId[p.id] ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(tagsByContentId[p.id] ?? []).map((id) => {
                      const t = tagLookup[id];
                      if (!t) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-body"
                          style={{ backgroundColor: t.color ?? "hsl(var(--muted))", color: t.color ? "white" : undefined }}
                        >
                          {t.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className={cn(
                "text-xs font-body font-semibold px-2.5 py-0.5 rounded-full shrink-0",
                p.status === "published" ? "bg-spa-sage/15 text-spa-sage" :
                p.status === "draft" ? "bg-muted text-muted-foreground" :
                "bg-destructive/10 text-destructive"
              )}>
                {p.status}
              </span>
              <Button size="sm" variant="ghost" onClick={() => togglePublish(p)} className="text-xs h-8">
                {p.status === "published" ? "Unpublish" : "Publish"}
              </Button>
              {p.status === "published" && (
                <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted rounded-lg" title="View">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              )}
              <button onClick={() => handleDuplicate(p)} className="p-2 hover:bg-muted rounded-lg" title="Duplicate">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => startEdit(p)} className="p-2 hover:bg-muted rounded-lg" title="Edit">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-destructive/10 rounded-lg" title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-8 text-center font-body text-sm text-muted-foreground">No posts found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
