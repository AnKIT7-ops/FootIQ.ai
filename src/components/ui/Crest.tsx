import { useState } from "react";
import { cn, isDarkHex } from "@/lib/utils";
import { getTeam } from "@/lib/repositories/teams";
import { teamLogoUrl } from "@/data/images";

/**
 * Team crest: real club logo from the FotMob CDN when reachable,
 * falling back to the original generated SVG shield offline / on error.
 */
export function Crest({ teamId, size = 36, className }: { teamId: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const team = getTeam(teamId);
  const url = teamLogoUrl(teamId);

  if (url && !failed) {
    return (
      <img
        src={url}
        width={size}
        height={size}
        alt={`${team.name} crest`}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn("shrink-0 select-none object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const [c1, c2] = team.colors;
  const dark = isDarkHex(c1);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`${team.name} crest`}
    >
      <path d="M20 2 36 8v14c0 10-6.6 16.4-16 20C10.6 38.4 4 32 4 22V8Z" fill={c1} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M20 2 36 8v14c0 10-6.6 16.4-16 20Z" fill={c2} opacity="0.28" />
      <path d="M20 6.2 32.4 10.9v10.9c0 7.8-5 12.9-12.4 16-7.4-3.1-12.4-8.2-12.4-16V10.9Z" fill="none" stroke={c2} strokeOpacity="0.55" strokeWidth="1.4" />
      <text
        x="20"
        y="26.5"
        textAnchor="middle"
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="700"
        fontSize="11"
        fill={dark ? "#f5f7fa" : "#10151e"}
        letterSpacing="0.5"
      >
        {team.tla}
      </text>
    </svg>
  );
}
