import { useId } from "react";
import { Legend } from "./common";

export interface RadarSeries {
  label: string;
  color: string;
  values: number[]; // 0-100, same length as axes
}

/** Multi-series radar with direct axis labels; legend shown for 2+ series. */
export function Radar({
  axes,
  series,
  size = 300,
  max = 100,
  className,
}: {
  axes: string[];
  series: RadarSeries[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const id = useId();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 56;
  const n = axes.length;

  const point = (i: number, v: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rad = (v / max) * r;
    return [cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad];
  };
  const ringPath = (v: number) =>
    Array.from({ length: n }, (_, i) => point(i, v))
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ") + " Z";

  return (
    <div className={className}>
      <svg viewBox={`-34 0 ${size + 68} ${size}`} className="w-full" role="img" aria-label={`Radar chart: ${series.map((s) => s.label).join(" vs ")}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <path key={f} d={ringPath(max * f)} fill="none" stroke="var(--line)" strokeWidth="1" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, max);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
        })}
        {series.map((s, si) => {
          const d =
            s.values.map((v, i) => {
              const [x, y] = point(i, v);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ") + " Z";
          return (
            <g key={s.label}>
              <path d={d} fill={s.color} opacity={si === 0 ? 0.16 : 0.12} />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
              {s.values.map((v, i) => {
                const [x, y] = point(i, v);
                return <circle key={i} cx={x} cy={y} r="2.6" fill={s.color} stroke="var(--surface)" strokeWidth="1.4" />;
              })}
            </g>
          );
        })}
        {axes.map((label, i) => {
          const [x, y] = point(i, max * 1.2);
          const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
          return (
            <text
              key={`${id}-${label}`}
              x={x}
              y={y + 3.5}
              textAnchor={anchor}
              fontSize="10.5"
              fontFamily="var(--font-mono)"
              fill="var(--ink-3)"
              style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              {label}
            </text>
          );
        })}
      </svg>
      {series.length > 1 && <Legend className="mt-2 justify-center" items={series.map((s) => ({ label: s.label, color: s.color }))} />}
    </div>
  );
}
