import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AI provenance strip — every substantial AI-generated block carries one:
 * confidence, generation timestamp, source references and the disclaimer.
 * Amber = model inference, per the FootIQ semantic accent rule.
 */
export function AIMeta({
  confidence,
  generatedAt,
  sources,
  className,
}: {
  /** 0–100. */
  confidence: number;
  /** ISO date or datetime. */
  generatedAt: string;
  sources?: { label: string; path: string }[];
  className?: string;
}) {
  const level = confidence >= 75 ? "High" : confidence >= 55 ? "Medium" : "Low";
  return (
    <div className={cn("rounded-2xl border border-iq/25 bg-iq-soft p-4", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-iq-ink">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Sparkles className="size-3.5" aria-hidden /> AI-generated analysis
        </span>
        <span className="inline-flex items-center gap-1.5" title={`Model confidence ${confidence}%`}>
          Confidence {level}
          <span
            role="img"
            aria-label={`Confidence ${confidence} percent`}
            className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-iq/20"
          >
            <span className="block h-full rounded-full bg-iq" style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} />
          </span>
          {confidence}%
        </span>
        <span>Generated {generatedAt.slice(0, 10)}</span>
      </div>
      {sources && sources.length > 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">Based on: </span>
          {sources.map((s, i) => (
            <span key={s.path}>
              {i > 0 && " · "}
              <Link to={s.path} className="underline decoration-iq/40 underline-offset-2 transition-colors hover:text-ink">
                {s.label}
              </Link>
            </span>
          ))}
        </p>
      )}
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
        Model inference from structured performance data — speculative analysis, not verified reporting. Not betting advice.
      </p>
    </div>
  );
}
