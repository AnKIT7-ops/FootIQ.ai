import { dataMode, useFreshness } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * Honest provenance chip — shown only when the user is looking at the
 * curated demo dataset instead of synced football data. Live data is the
 * normal state and needs no badge; demo data must never pass for real.
 * Reads the passive freshness signal (no requests of its own).
 */
export function DataFreshness({ className }: { className?: string }) {
  if (dataMode(useFreshness()) !== "demo") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-3",
        className,
      )}
      title="You're browsing the curated demo dataset — every feature works end-to-end"
    >
      <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
      Demo data
    </span>
  );
}
