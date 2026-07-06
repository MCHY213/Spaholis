import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react";
import { MediaPickerDialog } from "./MediaLibrary";

interface GalleryEditorProps {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
}

/** Reorderable multi-image gallery picker backed by the Media Library. */
export function GalleryEditor({ images, onChange, label = "Gallery" }: GalleryEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-sm font-medium text-foreground">{label}</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {images.length === 0 ? (
        <div className="aspect-video rounded-lg bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <p className="text-xs">No images yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={`${img}-${i}`} className="relative aspect-square group">
              <img src={img} alt="" className="w-full h-full object-cover rounded" />
              <div className="absolute inset-0 bg-background/0 group-hover:bg-background/40 transition-colors rounded flex items-end justify-between p-1 opacity-0 group-hover:opacity-100">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded bg-background/90 hover:bg-background disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                    className="p-1 rounded bg-background/90 hover:bg-background disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-1 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/90 text-[10px] font-mono">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(url) => { onChange([...images, url]); setPickerOpen(false); }}
      />
    </div>
  );
}
