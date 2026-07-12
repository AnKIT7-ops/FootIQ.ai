import { cn } from "@/lib/utils";

export interface CompareRow {
  label: string;
  a: number;
  b: number;
  format?: (v: number) => string;
  max?: number;
}

/**
 * Two-sided head-to-head stat bars. Bars grow outward from center;
 * values direct-labeled (relief for any contrast warning by design).
 */
export function CompareBars({
  rows,
  colorA = "var(--chart-1)",
  colorB = "var(--chart-4)",
  className,
}: {
  rows: CompareRow[];
  colorA?: string;
  colorB?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((r) => {
        const max = r.max ?? (Math.max(r.a, r.b) * 1.15 || 1);
        const fa = r.format ?? ((v: number) => String(Math.round(v * 10) / 10));
        const aWins = r.a > r.b;
        const bWins = r.b > r.a;
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className={cn("tabular w-16 font-mono text-[12.5px] font-semibold", aWins ? "text-ink" : "text-ink-3")}>{fa(r.a)}</span>
              <span className="text-center text-[12px] text-ink-2">{r.label}</span>
              <span className={cn("tabular w-16 text-right font-mono text-[12.5px] font-semibold", bWins ? "text-ink" : "text-ink-3")}>{fa(r.b)}</span>
            </div>
            <div className="flex items-center gap-[2px]">
              <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-l-full bg-surface-3">
                <div
                  className="h-full rounded-l-full transition-[width] duration-700"
                  style={{ width: `${(r.a / max) * 100}%`, background: colorA, opacity: aWins ? 1 : 0.45 }}
                />
              </div>
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-r-full bg-surface-3">
                <div
                  className="h-full rounded-r-full transition-[width] duration-700"
                  style={{ width: `${(r.b / max) * 100}%`, background: colorB, opacity: bWins ? 1 : 0.45 }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
