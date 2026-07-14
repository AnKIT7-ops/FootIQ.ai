import { type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { FeedbackWidget } from "@/components/ui/FeedbackWidget";
import { cn } from "@/lib/utils";

/**
 * The IQ layer — every AI-inferred element on FootIQ wears this amber treatment,
 * so users can always tell measured fact (emerald) from model inference (amber).
 */
export function IQInsight({
  children,
  title = "FootIQ Insight",
  className,
  compact = false,
  feedback,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
  compact?: boolean;
  /** Set to a subject label to render 👍/👎 under the insight (substantial blocks only). */
  feedback?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-iq/25 bg-iq-soft",
        compact ? "p-3.5" : "p-4 md:p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full opacity-25 blur-2xl"
        style={{ background: "var(--iq)" }}
      />
      <p className="mb-1.5 flex items-center gap-1.5 font-mono text-micro font-semibold uppercase tracking-[0.14em] text-iq-ink">
        <Sparkles className="size-3.5" aria-hidden />
        {title}
      </p>
      <div className={cn("text-ink", compact ? "text-ui leading-relaxed" : "text-sm leading-relaxed")}>{children}</div>
      {feedback && <FeedbackWidget subject={feedback} className="mt-3 border-t border-iq/15 pt-3" />}
    </div>
  );
}

/** Inline amber tag marking a value as model-derived. */
export function IQTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-iq-soft px-2 py-0.5 font-mono text-micro font-semibold uppercase tracking-wider text-iq-ink", className)}>
      <Sparkles className="size-3" aria-hidden />
      {children}
    </span>
  );
}
