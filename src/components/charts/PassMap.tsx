import { useId } from "react";
import { Pitch } from "./Pitch";
import { Legend } from "./common";
import type { PassArrow } from "@/data/generators";

/** Progressive pass arrows; key passes carry the amber IQ accent. */
export function PassMap({ passes, className }: { passes: PassArrow[]; className?: string }) {
  const uid = useId();
  return (
    <div className={className}>
      <Pitch>
        <defs>
          <marker id={`${uid}-a`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--chart-2)" />
          </marker>
          <marker id={`${uid}-k`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--chart-3)" />
          </marker>
        </defs>
        {passes.map((p, i) => {
          const x1 = (p.x1 / 100) * 105;
          const y1 = (p.y1 / 100) * 68;
          const x2 = (p.x2 / 100) * 105;
          const y2 = (p.y2 / 100) * 68;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={p.key ? "var(--chart-3)" : "var(--chart-2)"}
              strokeWidth={p.key ? 0.7 : 0.45}
              opacity={p.key ? 0.95 : 0.55}
              markerEnd={`url(#${uid}-${p.key ? "k" : "a"})`}
            />
          );
        })}
      </Pitch>
      <Legend
        className="mt-2"
        items={[
          { label: "Completed pass", color: "var(--chart-2)", shape: "line" },
          { label: "Key pass", color: "var(--chart-3)", shape: "line" },
        ]}
      />
    </div>
  );
}
