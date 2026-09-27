import { Pitch } from "./Pitch";
import type { LineupPlayer } from "@/data/types";

/**
 * Match lineups on the full pitch — home attacks right, away attacks left.
 * Ratings shown as amber-tinted pills above each marker.
 */
export function Formation({
  home,
  away,
  homeColor,
  awayColor,
  showRatings = true,
  className,
}: {
  home: LineupPlayer[];
  away?: LineupPlayer[];
  homeColor: string;
  awayColor?: string;
  showRatings?: boolean;
  className?: string;
}) {
  return (
    <Pitch className={className}>
      {home.map((p) => (
        <PlayerDot key={`h-${p.shirt}`} p={p} color={homeColor} mirror={false} showRating={showRatings} />
      ))}
      {away?.map((p) => (
        <PlayerDot key={`a-${p.shirt}`} p={p} color={awayColor ?? "var(--chart-4)"} mirror showRating={showRatings} />
      ))}
    </Pitch>
  );
}

function PlayerDot({ p, color, mirror, showRating }: { p: LineupPlayer; color: string; mirror: boolean; showRating: boolean }) {
  // lineup coords: x = width%, y = depth% from own goal
  const px = mirror ? 105 - (p.y / 100) * 105 * 0.5 - 0 : (p.y / 100) * 105 * 0.5;
  const py = mirror ? 68 - (p.x / 100) * 68 : (p.x / 100) * 68;
  const good = p.rating >= 7.5;
  const pillX = px > 96 ? px - 7 : px + 1.6;
  return (
    <g>
      <circle cx={px} cy={py} r="2.6" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="0.3" />
      <text x={px} y={py + 1} textAnchor="middle" fontSize="2.4" fontWeight="700" fontFamily="var(--font-mono)" fill="white">
        {p.shirt}
      </text>
      <text x={px} y={py + 5.6} textAnchor="middle" fontSize="2.1" fontFamily="var(--font-sans)" fill="var(--ink-2)">
        {lastName(p.name)}
      </text>
      {showRating && (
        <g>
          <rect x={pillX} y={py - 5.4} width="5.4" height="3" rx="1.5" fill={good ? "var(--iq)" : "var(--surface-3)"} />
          <text x={pillX + 2.7} y={py - 3.2} textAnchor="middle" fontSize="2" fontWeight="700" fontFamily="var(--font-mono)" fill={good ? "#04110c" : "var(--ink-2)"}>
            {p.rating.toFixed(1)}
          </text>
        </g>
      )}
    </g>
  );
}

function lastName(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1];
}
