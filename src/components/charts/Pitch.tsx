import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The chalk pitch — FootIQ's recurring canvas. Full pitch 105x68 units,
 * children render in that coordinate space (x: 0-105 length, y: 0-68 width).
 */
export function Pitch({
  children,
  half = false,
  className,
  vertical = false,
}: {
  children?: ReactNode;
  half?: boolean;
  className?: string;
  vertical?: boolean;
}) {
  const W = half ? 52.5 : 105;
  const H = 68;
  const viewBox = vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;
  return (
    <svg
      viewBox={viewBox}
      className={cn("w-full rounded-xl", className)}
      style={{ background: "var(--pitch)" }}
      role="img"
      aria-label="Football pitch"
    >
      <g
        stroke="var(--pitch-line)"
        strokeWidth="0.45"
        fill="none"
        transform={vertical ? `rotate(90 ${H / 2} ${H / 2})` : undefined}
      >
        {/* outer boundary */}
        <rect x="1.2" y="1.2" width={W - 2.4} height={H - 2.4} rx="0.8" />
        {!half && (
          <>
            <line x1={W / 2} y1="1.2" x2={W / 2} y2={H - 1.2} />
            <circle cx={W / 2} cy={H / 2} r="9.15" />
            <circle cx={W / 2} cy={H / 2} r="0.6" fill="var(--pitch-line)" stroke="none" />
          </>
        )}
        {/* left penalty + goal areas (attacking right) */}
        <rect x="1.2" y={H / 2 - 20.16} width="16.5" height="40.32" />
        <rect x="1.2" y={H / 2 - 9.16} width="5.5" height="18.32" />
        <circle cx="12.2" cy={H / 2} r="0.6" fill="var(--pitch-line)" stroke="none" />
        <path d={`M 17.7 ${H / 2 - 7.3} A 9.15 9.15 0 0 1 17.7 ${H / 2 + 7.3}`} />
        {!half && (
          <>
            <rect x={W - 17.7} y={H / 2 - 20.16} width="16.5" height="40.32" />
            <rect x={W - 6.7} y={H / 2 - 9.16} width="5.5" height="18.32" />
            <circle cx={W - 12.2} cy={H / 2} r="0.6" fill="var(--pitch-line)" stroke="none" />
            <path d={`M ${W - 17.7} ${H / 2 - 7.3} A 9.15 9.15 0 0 0 ${W - 17.7} ${H / 2 + 7.3}`} />
          </>
        )}
        {half && <path d={`M ${W - 1.2} ${H / 2 - 9.15} A 9.15 9.15 0 0 0 ${W - 1.2} ${H / 2 + 9.15}`} />}
      </g>
      <g transform={vertical ? `rotate(90 ${H / 2} ${H / 2})` : undefined}>{children}</g>
    </svg>
  );
}
