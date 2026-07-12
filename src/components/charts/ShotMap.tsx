import { useState } from "react";
import { Pitch } from "./Pitch";
import { Legend } from "./common";
import type { Shot } from "@/data/generators";

const OUTCOME = {
  goal: { color: "var(--chart-1)", label: "Goal" },
  saved: { color: "var(--chart-2)", label: "Saved" },
  missed: { color: "var(--ink-3)", label: "Missed" },
  blocked: { color: "var(--chart-3)", label: "Blocked" },
} as const;

/** Shot map on the attacking half; marker size = xG, outcome = color + shape (goals filled, rest rings). */
export function ShotMap({ shots, className }: { shots: Shot[]; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className={className}>
      <div className="relative">
        <Pitch half>
          {shots.map((s, i) => {
            // map shot x (50-100 of full pitch) onto half-pitch (0-52.5), attacking right
            const px = ((s.x - 50) / 50) * 52.5;
            const py = (s.y / 100) * 68;
            const r = 1.1 + s.xg * 3.2;
            const o = OUTCOME[s.outcome];
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                {/* oversized invisible hit target */}
                <circle cx={px} cy={py} r={r + 2} fill="transparent" />
                {s.outcome === "goal" ? (
                  <circle cx={px} cy={py} r={r} fill={o.color} stroke="var(--pitch)" strokeWidth="0.5" />
                ) : (
                  <circle cx={px} cy={py} r={r} fill="none" stroke={o.color} strokeWidth="0.7" opacity="0.9" />
                )}
                {hover === i && (
                  <g pointerEvents="none">
                    <rect x={px - 11} y={py - r - 8.5} width="22" height="6.5" rx="1.6" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="0.25" />
                    <text x={px} y={py - r - 4} textAnchor="middle" fontSize="3.4" fontFamily="var(--font-mono)" fill="var(--ink)">
                      {`${s.minute}' · ${o.label} · xG ${s.xg.toFixed(2)}`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </Pitch>
      </div>
      <Legend
        className="mt-2"
        items={[
          { label: "Goal", color: OUTCOME.goal.color },
          { label: "Saved", color: OUTCOME.saved.color, shape: "ring" },
          { label: "Missed", color: OUTCOME.missed.color, shape: "ring" },
          { label: "Blocked", color: OUTCOME.blocked.color, shape: "ring" },
        ]}
      />
    </div>
  );
}
