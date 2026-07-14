import { useFreshness } from "@/lib/freshness";
import { backendConfigured } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Honest provenance chip — tells the user whether they're looking at live
 * synced football data or the curated demo dataset. Reads the passive
 * freshness signal (no requests of its own).
 */
export function DataFreshness({ className }: { className?: string }) {
  const { source } = useFreshness();
  const resolved = source === "unknown" && !backendConfigured ? "demo" : source;
  if (resolved === "unknown") return null; // backend configured but no response yet — say nothing rather than guess

  const live = resolved === "provider";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-micro uppercase tracking-[0.12em]",
        live ? "border-accent/35 bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-3",
        className,
      )}
      title={
        live
          ? "League standings and fixtures are synced from football-data.org"
          : "You're browsing the curated demo dataset — every feature works end-to-end"
      }
    >
      <span className={cn("size-1.5 rounded-full", live ? "bg-accent" : "bg-ink-3")} aria-hidden />
      {live ? "Live data" : "Demo data"}
    </span>
  );
}
