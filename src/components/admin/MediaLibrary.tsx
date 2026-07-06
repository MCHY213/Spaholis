import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Trash2, Copy, Check, Image as ImageIcon, Search, X, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MediaFile {
  name: string;
  path: string;
  url: string;
  size: number;
  created_at: string;
}

const BUCKET = "media-library";

async function listAll(): Promise<MediaFile[]> {
  // List root
  const { data: rootItems } = await supabase.storage.from(BUCKET).list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  const all: MediaFile[] = [];
  for (const item of rootItems ?? []) {
    if (item.id === null) {
      // folder
      const { data: subItems } = await supabase.storage.from(BUCKET).list(item.name, { limit: 1000 });
      for (const sub of subItems ?? []) {
        if (sub.id !== null) {
          const path = `${item.name}/${sub.name}`;
          const { data: u } = supabase.storage.from(BUCKET).getPublicUrl(path);
          all.push({
            name: sub.name,
            path,
            url: u.publicUrl,
            size: (sub.metadata as any)?.size ?? 0,
            created_at: sub.created_at ?? "",
          });
        }
      }
    } else {
      const { data: u } = supabase.storage.from(BUCKET).getPublicUrl(item.name);
      all.push({
        name: item.name,
        path: item.name,
        url: u.publicUrl,
        size: (item.metadata as any)?.size ?? 0,
        created_at: item.created_at ?? "",
      });
    }
  }
  return all;
}

interface Props {
  /** When true, the "Use" button calls onSelect and closes; else just shows copy. */
  pickerMode?: boolean;
  onSelect?: (url: string) => void;
}

export function MediaLibrary({ pickerMode, onSelect }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [folder, setFolder] = useState("uploads");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");

  const load = useCallback(async () => {
    const items = await listAll();
    setFiles(items);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []);
    if (!fileList.length) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const file of fileList) {
      const ext = file.name.split(".").pop();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${folder}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) { fail++; toast.error(`${file.name}: ${error.message}`); }
      else ok++;
    }
    setUploading(false);
    if (ok) toast.success(`Uploaded ${ok} file${ok > 1 ? "s" : ""}`);
    e.target.value = "";
    load();
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Delete ${path}?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const handleCopy = async (url: string, path: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedPath(path);
    toast.success("URL copied");
    setTimeout(() => setCopiedPath(null), 1500);
  };

  const handleUseExternal = () => {
    if (!externalUrl.trim()) return;
    if (onSelect) onSelect(externalUrl.trim());
    setExternalUrl("");
    setShowUrlInput(false);
  };

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.path.toLowerCase().includes(search.toLowerCase()));

  const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm font-body"
        >
          <option value="uploads">uploads/</option>
          <option value="blog">blog/</option>
          <option value="services">services/</option>
          <option value="retreats">retreats/</option>
          <option value="products">products/</option>
        </select>
        <label className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer text-sm font-body font-medium transition-colors",
          uploading ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
        )}>
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload"}
          <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
        {pickerMode && (
          <Button variant="outline" size="sm" onClick={() => setShowUrlInput((s) => !s)}>
            <LinkIcon className="h-4 w-4 mr-1" /> Paste URL
          </Button>
        )}
      </div>

      {showUrlInput && pickerMode && (
        <div className="flex gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <Input
            placeholder="https://..."
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
          />
          <Button onClick={handleUseExternal} size="sm">Use</Button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((f) => (
          <div key={f.path} className="group relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="aspect-square bg-muted/40 flex items-center justify-center">
              {isImage(f.name) ? (
                <img src={f.url} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="p-2">
              <p className="font-body text-xs truncate text-foreground" title={f.name}>{f.name}</p>
              <p className="font-body text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="absolute inset-x-0 top-0 p-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-foreground/40 to-transparent">
              {pickerMode && onSelect && (
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onSelect(f.url)}>
                  Use
                </Button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(f.url, f.path)}
                className="p-1.5 rounded bg-background/90 hover:bg-background text-foreground"
                title="Copy URL"
              >
                {copiedPath === f.path ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(f.path)}
                className="p-1.5 rounded bg-background/90 hover:bg-destructive hover:text-destructive-foreground text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground font-body text-sm">
            No media found. Upload your first file above.
          </div>
        )}
      </div>
    </div>
  );
}

/** Modal picker for selecting a media URL from anywhere in admin. */
export function MediaPickerDialog({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (url: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose from Media Library</DialogTitle>
        </DialogHeader>
        <MediaLibrary
          pickerMode
          onSelect={(url) => {
            onSelect(url);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
