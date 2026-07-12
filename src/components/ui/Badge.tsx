import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "accent" | "iq" | "live" | "good" | "warn" | "bad" | "outline";

const styles: Record<Variant, string> = {
  neutral: "bg-surface-3 text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  iq: "bg-iq-soft text-iq-ink",
  live: "bg-accent-soft text-accent-ink",
  good: "bg-accent-soft text-accent-ink",
  warn: "bg-iq-soft text-iq-ink",
  bad: "bg-bad/10 text-bad",
  outline: "border border-line-strong text-ink-2 bg-transparent",
};

export function Badge({
  children,
  variant = "neutral",
  className,
  mono = true,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        mono && "font-mono uppercase",
        styles[variant],
        className,
      )}
    >
      {variant === "live" && (
        <span className="animate-pulse-live inline-block size-1.5 rounded-full bg-live" aria-hidden />
      )}
      {children}
    </span>
  );
}

/** WWDLW form pills. */
export function FormPills({ form, className }: { form: string; className?: string }) {
  return (
    <span className={cn("inline-flex gap-1", className)} aria-label={`Form: ${form}`}>
      {form.split("").map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-md font-mono text-[10px] font-bold",
            r === "W" && "bg-accent-soft text-accent-ink",
            r === "D" && "bg-surface-3 text-ink-2",
            r === "L" && "bg-bad/10 text-bad",
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

/** 5-dot source reliability indicator. */
export function Reliability({ score, className }: { score: number; className?: string }) {
  const label = score >= 4 ? "Verified" : score >= 3 ? "Reliable" : score >= 2 ? "Unverified" : "Speculative";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`Source reliability ${score}/5`}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              "inline-block h-2.5 w-1 rounded-full",
              i <= score ? (score >= 4 ? "bg-accent" : score >= 3 ? "bg-chart-2" : "bg-warn") : "bg-surface-3",
            )}
          />
        ))}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">{label}</span>
    </span>
  );
}
