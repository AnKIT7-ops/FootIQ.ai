import { useCountUp } from "@/lib/hooks";
import { cn, signed } from "@/lib/utils";

/** Hero-number stat tile (dataviz: value + label + optional delta, no decorative plot). */
export function StatTile({
  label,
  value,
  suffix = "",
  decimals = 0,
  delta,
  deltaSuffix = "",
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  delta?: number;
  deltaSuffix?: string;
  className?: string;
}) {
  const display = useCountUp(value, 900, decimals);
  return (
    <div className={cn("card px-4 py-3.5", className)}>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-1 font-display text-figure font-bold leading-none text-ink">
        {display}
        {suffix && <span className="ml-0.5 text-base font-semibold text-ink-2">{suffix}</span>}
      </p>
      {delta !== undefined && (
        <p className={cn("tabular mt-1 font-mono text-label", delta >= 0 ? "text-accent-ink" : "text-bad")}>
          {signed(delta)}
          {deltaSuffix}
        </p>
      )}
    </div>
  );
}

/** Labeled meter 0-100 with value readout. */
export function Meter({
  label,
  value,
  max = 100,
  color = "var(--chart-1)",
  className,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-ui text-ink-2">{label}</span>
        <span className="tabular font-mono text-xs font-semibold text-ink">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}
