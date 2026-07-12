import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Positioned tooltip box for SVG charts (parent must be relative). */
export function TooltipBox({
  x,
  y,
  children,
  visible,
}: {
  x: number;
  y: number;
  children: ReactNode;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-xl"
      style={{ left: x, top: y - 8 }}
      role="status"
    >
      {children}
    </div>
  );
}

/** Swatch + label legend row (identity never color-alone: labels always visible). */
export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string; shape?: "dot" | "line" | "ring" }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          {it.shape === "line" ? (
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: it.color }} aria-hidden />
          ) : it.shape === "ring" ? (
            <span className="inline-block size-2.5 rounded-full border-2" style={{ borderColor: it.color }} aria-hidden />
          ) : (
            <span className="inline-block size-2.5 rounded-full" style={{ background: it.color }} aria-hidden />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
