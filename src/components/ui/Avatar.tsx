import { useState } from "react";
import { cn, initials, hashCode } from "@/lib/utils";

const HUES = [158, 200, 262, 20, 330, 90];

/**
 * Player facecard: real portrait (Premier League CDN, from the FPL sync) over
 * the duotone disc; initials when there's no photo or it fails to load.
 */
export function Avatar({
  name,
  photoUrl,
  size = 40,
  ringColor,
  className,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
  ringColor?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const hue = HUES[hashCode(name) % HUES.length];
  const photo = photoUrl;
  const showPhoto = photo !== undefined && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display font-bold",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        color: "white",
        background: `linear-gradient(135deg, oklch(0.45 0.09 ${hue}), oklch(0.28 0.07 ${hue + 40}))`,
        boxShadow: ringColor ? `0 0 0 2px var(--surface), 0 0 0 4px ${ringColor}` : undefined,
        letterSpacing: "0.02em",
      }}
      aria-hidden
    >
      {!showPhoto && initials(name)}
      {showPhoto && (
        <img
          src={photo}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
    </span>
  );
}
