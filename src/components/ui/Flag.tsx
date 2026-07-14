import { useState } from "react";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/data/images";

/** National flag image (flagcdn) with emoji fallback — Windows renders flag emoji as letters, so the image is the primary. */
export function Flag({
  nationality,
  emoji,
  className,
}: {
  nationality: string;
  emoji?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = flagUrl(nationality);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={`${nationality} flag`}
        title={nationality}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn("inline-block h-[0.95em] w-auto rounded-[2px] align-[-0.08em] ring-1 ring-line-strong", className)}
      />
    );
  }
  return <span className={className}>{emoji ?? "🏳️"}</span>;
}
