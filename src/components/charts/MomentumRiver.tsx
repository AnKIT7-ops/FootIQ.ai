import { useId, useRef, useState } from "react";
import { linePath } from "@/lib/utils";
import { Legend, TooltipBox } from "./common";

/**
 * FootIQ's signature match visualization: a diverging momentum river.
 * Values -1..1 per ~5-minute bucket; above the midline = home pressure, below = away.
 */
export function MomentumRiver({
  data,
  homeLabel,
  awayLabel,
  height = 150,
  className,
}: {
  data: number[];
  homeLabel: string;
  awayLabel: string;
  height?: number;
  className?: string;
}) {
  const W = 640;
  const H = height;
  const mid = H / 2;
  const pad = 8;
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);

  if (data.length < 2) return null;
  const step = (W - pad * 2) / (data.length - 1);
  const pts: Array<[number, number]> = data.map((v, i) => [pad + i * step, mid - v * (mid - 10)]);
  const line = linePath(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${mid} L${pts[0][0]},${mid} Z`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round((relX - pad) / step);
    if (i < 0 || i >= data.length) return setTip(null);
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    setTip({
      x: ((pts[i][0] / W) * rect.width + rect.left - wrap.left),
      y: ((pts[i][1] / H) * rect.height + rect.top - wrap.top),
      i,
    });
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        role="img"
        aria-label={`Momentum: ${homeLabel} vs ${awayLabel}`}
      >
        <defs>
          <clipPath id={`${uid}-top`}>
            <rect x="0" y="0" width={W} height={mid} />
          </clipPath>
          <clipPath id={`${uid}-bottom`}>
            <rect x="0" y={mid} width={W} height={mid} />
          </clipPath>
        </defs>
        <path d={area} fill="var(--chart-1)" opacity="0.34" clipPath={`url(#${uid}-top)`} />
        <path d={area} fill="var(--chart-4)" opacity="0.34" clipPath={`url(#${uid}-bottom)`} />
        <path d={line} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" opacity="0.85" clipPath={`url(#${uid}-top)`} />
        <path d={line} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" opacity="0.85" clipPath={`url(#${uid}-bottom)`} />
        <line x1={pad} y1={mid} x2={W - pad} y2={mid} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 4" />
        {tip && (
          <g>
            <line x1={pts[tip.i][0]} y1={8} x2={pts[tip.i][0]} y2={H - 8} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={pts[tip.i][0]} cy={pts[tip.i][1]} r="4" fill={data[tip.i] >= 0 ? "var(--chart-1)" : "var(--chart-4)"} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        <text x={pad} y={12} fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">0'</text>
        <text x={W - pad} y={12} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{`${data.length * 5}'`}</text>
      </svg>
      {tip && (
        <TooltipBox x={tip.x} y={tip.y} visible>
          <span className="font-mono text-[11px] text-ink-3">{tip.i * 5}–{tip.i * 5 + 5}'</span>{" "}
          <span className="font-semibold text-ink">
            {data[tip.i] >= 0 ? homeLabel : awayLabel} {Math.round(Math.abs(data[tip.i]) * 100)}%
          </span>
        </TooltipBox>
      )}
      <Legend
        className="mt-1.5"
        items={[
          { label: homeLabel, color: "var(--chart-1)" },
          { label: awayLabel, color: "var(--chart-4)" },
        ]}
      />
    </div>
  );
}
