import { Pitch } from "./Pitch";
import type { HeatCell } from "@/data/generators";

/**
 * Touch heatmap: sequential single-hue (emerald) — magnitude via opacity+radius,
 * rendered as soft chalk clouds on the pitch canvas.
 */
export function Heatmap({ cells, className }: { cells: HeatCell[]; className?: string }) {
  return (
    <div className={className}>
      <Pitch>
        {cells.map((c, i) => (
          <circle
            key={i}
            cx={(c.x / 100) * 105}
            cy={(c.y / 100) * 68}
            r={2.2 + c.v * 5.4}
            fill="var(--chart-1)"
            opacity={0.08 + c.v * 0.5}
            style={{ filter: "blur(2.5px)" }}
          />
        ))}
      </Pitch>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-micro uppercase tracking-wider text-ink-3">Attacking →</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ink-3">
          Low
          <span className="inline-flex gap-0.5" aria-hidden>
            {[0.15, 0.35, 0.55, 0.8].map((o) => (
              <span key={o} className="inline-block size-2.5 rounded-sm" style={{ background: "var(--chart-1)", opacity: o }} />
            ))}
          </span>
          High
        </span>
      </div>
    </div>
  );
}
