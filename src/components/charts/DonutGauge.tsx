import { cn } from "@/lib/utils";

/** Single-value probability arc with center readout. */
export function DonutGauge({
  value,
  label,
  size = 108,
  color = "var(--chart-1)",
  className,
}: {
  value: number; // 0-100
  label: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${Math.round(value)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 700ms ease" }}
        />
        <text
          x="50%"
          y="50%"
          dy="0.06em"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="var(--font-display)"
          fontWeight="700"
          fontSize={size * 0.24}
          fill="var(--ink)"
        >
          {Math.round(value)}%
        </text>
      </svg>
      <span className="max-w-[9rem] text-center font-mono text-micro uppercase tracking-wider text-ink-3">{label}</span>
    </div>
  );
}
