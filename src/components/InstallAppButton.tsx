import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * "Download the app" — installs the site as a PWA (uses the site.webmanifest).
 * Chrome/Edge/Android: captures beforeinstallprompt and triggers the native
 * install dialog. iOS Safari has no API, so we show Add-to-Home-Screen steps.
 * Hidden when already running as the installed app.
 */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIOS = /iphone|ipad|ipod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");

  const onClick = async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* dismissed */ }
      setDeferred(null);
    } else {
      // No native prompt available (iOS, or already dismissed) — show steps.
      setShowHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-body font-medium transition-colors ${className}`}
      >
        <Download className="h-3.5 w-3.5" /> Download the app
      </button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Install the Holis app</DialogTitle>
          </DialogHeader>
          {isIOS ? (
            <ol className="space-y-3 text-sm font-body text-foreground">
              <li className="flex items-start gap-2.5">
                <Share className="h-4 w-4 mt-0.5 text-spa-sage shrink-0" />
                <span>In <strong>Safari</strong>, tap the <strong>Share</strong> button (square with an arrow).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <PlusSquare className="h-4 w-4 mt-0.5 text-spa-sage shrink-0" />
                <span>Scroll and tap <strong>"Add to Home Screen"</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Download className="h-4 w-4 mt-0.5 text-spa-sage shrink-0" />
                <span>Tap <strong>Add</strong> — the Holis app appears on your home screen.</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm font-body text-foreground">
              <li className="flex items-start gap-2.5">
                <MoreVertical className="h-4 w-4 mt-0.5 text-spa-sage shrink-0" />
                <span>Open your browser's menu (<strong>⋮</strong> or <strong>…</strong>).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Download className="h-4 w-4 mt-0.5 text-spa-sage shrink-0" />
                <span>Choose <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>).</span>
              </li>
            </ol>
          )}
          <p className="text-xs text-muted-foreground font-body">Free — no app store needed. Opens full-screen like a native app.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
