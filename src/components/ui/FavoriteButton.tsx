import { Bookmark, Star } from "lucide-react";
import { isBookmarked, isFavorite, toggleBookmark, toggleFavorite, useUserData, type Bookmark as BookmarkEntry, type FavoriteKind } from "@/lib/user";
import { cn } from "@/lib/utils";

/** Star toggle for teams/players — feeds the profile watchlist and notifications. */
export function FavoriteButton({ kind, refId, name, className }: { kind: FavoriteKind; refId: string; name: string; className?: string }) {
  useUserData(); // re-render on toggle
  const on = isFavorite(kind, refId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
      onClick={() => toggleFavorite(kind, refId)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-micro uppercase tracking-wider transition-colors",
        on
          ? "border-accent/40 bg-accent-soft text-accent-ink"
          : "border-line-strong bg-surface-2 text-ink-2 hover:border-accent/40 hover:text-ink",
        className,
      )}
    >
      <Star className={cn("size-3.5", on && "fill-current")} aria-hidden />
      {on ? "Following" : "Follow"}
    </button>
  );
}

/** Bookmark toggle for news/intelligence reports. */
export function BookmarkButton({ entry, className }: { entry: Omit<BookmarkEntry, "savedAt">; className?: string }) {
  useUserData();
  const on = isBookmarked(entry.refId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove bookmark" : "Bookmark for later"}
      onClick={() => toggleBookmark(entry)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-micro uppercase tracking-wider transition-colors",
        on
          ? "border-iq/40 bg-iq-soft text-iq-ink"
          : "border-line-strong bg-surface-2 text-ink-2 hover:border-iq/40 hover:text-ink",
        className,
      )}
    >
      <Bookmark className={cn("size-3.5", on && "fill-current")} aria-hidden />
      {on ? "Saved" : "Save"}
    </button>
  );
}
