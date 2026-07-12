import { linePath } from "@/lib/utils";

/** Minimal inline trend line (no axes — context supplied by surrounding tile). */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = "var(--chart-1)",
  area = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  area?: boolean;
  className?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;
  const pts: Array<[number, number]> = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const d = linePath(pts);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      {area && (
        <path
          d={`${d} L${last[0]},${height - 1} L${pts[0][0]},${height - 1} Z`}
          fill={color}
          opacity="0.12"
        />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}
