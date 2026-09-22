import { ExternalLink } from "lucide-react";
import type { NewsHeadline } from "@shared/contracts";
import { Badge } from "./Badge";
import { agoFromMinutes, cn } from "@/lib/utils";

const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

/**
 * One real headline. The card IS the link out to the publisher — we show their
 * headline and their own summary, never a rewritten article.
 */
export function HeadlineCard({ h, lead = false, compact = false }: { h: NewsHeadline; lead?: boolean; compact?: boolean }) {
  return (
    <a
      href={h.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "card group flex gap-4 transition-colors hover:border-line-strong focus-visible:border-accent",
        lead ? "floodlight flex-col p-5 md:flex-row md:p-6" : compact ? "p-3.5" : "p-4 md:p-5",
      )}
    >
      {h.imageUrl && !compact && (
        <img
          src={h.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn("shrink-0 rounded-xl bg-surface-2 object-cover", lead ? "aspect-video w-full md:w-72" : "hidden h-20 w-32 sm:block")}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {h.category !== "News" && <Badge variant={h.category === "Transfers" ? "warn" : h.category === "Injuries" ? "bad" : "neutral"}>{h.category}</Badge>}
          <span className="font-mono text-micro text-ink-3">
            {h.source} · {agoFromMinutes(minutesSince(h.publishedIso))}
          </span>
        </div>
        <h3 className={cn("mt-2 font-bold leading-snug text-ink group-hover:underline", lead ? "text-xl md:text-2xl" : compact ? "text-ui" : "text-prose")}>
          {h.title}
        </h3>
        {h.summary && !compact && <p className={cn("mt-1.5 text-ui leading-relaxed text-ink-2", !lead && "line-clamp-2")}>{h.summary}</p>}
        {!compact && (
          <span className="mt-2.5 inline-flex items-center gap-1 font-mono text-micro uppercase tracking-wider text-accent-ink">
            Read on {h.source} <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </span>
        )}
      </div>
    </a>
  );
}
