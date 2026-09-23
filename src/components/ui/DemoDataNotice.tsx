import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page-level provenance banner for a domain served from the bundled demo
 * dataset rather than a real feed.
 *
 * Sibling of `DemoEngineChip`, which marks who *inferred* something. This marks
 * where the underlying *data* came from. Matches and standings are provider-
 * synced and never carry this; nor do players and fantasy (FPL sync). History
 * and manager profiles have no real provider yet and always do.
 *
 * Deliberately a banner, not a chip: a chip in a corner is easy to miss, and
 * an entire page of invented transfer rumours reads as reporting unless
 * something says otherwise before the user starts believing it.
 */
export function DemoDataNotice({ domain, detail, className }: { domain: string; detail?: string; className?: string }) {
  return (
    <div
      className={cn(
        "mb-5 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5",
        className,
      )}
      role="note"
    >
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
      <p className="text-caption leading-relaxed text-ink-3">
        <span className="font-semibold text-ink-2">Demo {domain} data.</span>{" "}
        {detail ?? `These ${domain} are illustrative sample data, not a real feed. Nothing here reflects actual events.`}
      </p>
    </div>
  );
}
