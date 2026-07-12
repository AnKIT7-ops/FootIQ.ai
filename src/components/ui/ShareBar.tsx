import { useState } from "react";
import { Check, Download, Link2, Share2 } from "lucide-react";
import { copyLink, downloadShareCard, webShare } from "@/lib/share";
import { cn } from "@/lib/utils";

/**
 * Share actions for a major page: copy link, native share, download a
 * branded PNG card. Social preview itself comes from the page's OG tags.
 */
export function ShareBar({
  title,
  path,
  kind,
  stat,
  className,
}: {
  title: string;
  path: string;
  kind?: string;
  stat?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const flash = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 1600);
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent/40 hover:text-ink";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Share this page">
      <button type="button" className={btn} onClick={() => void copyLink(path).then((ok) => ok && flash(setCopied))}>
        {copied ? <Check className="size-3.5 text-accent" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button type="button" className={btn} onClick={() => void webShare(title, path).then((r) => r === "copied" && flash(setCopied))}>
        <Share2 className="size-3.5" aria-hidden /> Share
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => void downloadShareCard({ title, path, kind, stat }).then((ok) => ok && flash(setDownloaded))}
      >
        {downloaded ? <Check className="size-3.5 text-accent" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
        {downloaded ? "Saved" : "Card"}
      </button>
    </div>
  );
}
