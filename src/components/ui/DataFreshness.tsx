import { dataMode, relativeTime, useFreshness } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * Honest provenance chip — tells the user whether they're looking at live
 * synced football data or the curated demo dataset. Reads the passive
 * freshness signal (no requests of its own).
 */
export function DataFreshness({ className }: { className?: string }) {
  const freshness = useFreshness();
  const { syncedAt } = freshness;
  const resolved = dataMode(freshness);
  if (resolved === "unknown") return null; // backend configured but no response yet — say nothing rather than guess

  const live = resolved === "provider";
  // Age of the SYNC, not of the page load — the only version of this that can
  // reveal a stalled sync. Needs no extra request: it rides on response meta.
  const age = live ? relativeTime(syncedAt) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-micro uppercase tracking-[0.12em]",
        live ? "border-accent/35 bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-3",
        className,
      )}
      title={
        live
          ? `League standings and fixtures are synced from football-data.org${syncedAt ? ` — last sync ${new Date(syncedAt).toLocaleString()}` : ""}`
          : "You're browsing the curated demo dataset — every feature works end-to-end"
      }
    >
      <span className={cn("size-1.5 rounded-full", live ? "bg-accent" : "bg-ink-3")} aria-hidden />
      {live ? "Live data" : "Demo data"}
      {age && <span className="text-ink-3 normal-case">· {age}</span>}
    </span>
  );
}
