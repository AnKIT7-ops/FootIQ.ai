import { Link } from "react-router-dom";
import { ArrowRight, BookmarkCheck, Clock3, Heart, Sparkles, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { useUserData } from "@/lib/user";
import { useRecentViews } from "@/lib/recent";
import { getTeam } from "@/lib/repositories/teams";
import { getPlayer, usePlayers } from "@/lib/repositories/players";
import { playerPathFor, teamPathFor } from "@/lib/slug-builders";
import { agoFromMinutes } from "@/lib/utils";

/**
 * Homepage personalization — renders nothing for a brand-new visitor and
 * grows as the user favorites, bookmarks and browses. Local-first: everything
 * reads the device stores, no backend required.
 */
export function PersonalRows() {
  const { bookmarks, favorites } = useUserData();
  const recents = useRecentViews();

  const favTeams = favorites
    .filter((f) => f.kind === "team")
    .map((f) => getTeam(f.refId))
    .filter((t) => favorites.some((f) => f.kind === "team" && f.refId === t.id)); // getTeam falls back to the first team for unknown ids — keep only real hits
  usePlayers(); // players arrive from the API — re-render when they do
  const favPlayers = favorites
    .filter((f) => f.kind === "player")
    .map((f) => getPlayer(f.refId))
    .filter((p) => p !== undefined); // follows of retired demo ids resolve to nothing
  const reading = bookmarks.slice(0, 3);
  const viewed = recents.slice(0, 8);
  const lastPlayer = recents.find((r) => r.kind === "player");

  if (!reading.length && !viewed.length && !favTeams.length && !favPlayers.length) return null;

  return (
    <section aria-label="For you" className="space-y-4">
      <p className="eyebrow flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-iq-ink" aria-hidden />
        For you — built from what you follow on this device
      </p>

      {(favTeams.length > 0 || favPlayers.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {favTeams.length > 0 && (
            <Card className="p-4">
              <p className="mb-2.5 flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ink-3">
                <Heart className="size-3" aria-hidden /> Your clubs
              </p>
              <ul className="space-y-2">
                {favTeams.slice(0, 4).map((t) => {
                  const pos = t.position; // its own league's position — the Home table holds one league only
                  return (
                    <li key={t.id}>
                      <Link to={teamPathFor(t)} className="group flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-surface-2">
                        <Crest teamId={t.id} size={26} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ui font-semibold text-ink">{t.name}</span>
                          <span className="block text-label text-ink-3">
                            {pos > 0 ? `#${pos} · ` : ""}
                            {t.league}
                          </span>
                        </span>
                        <ArrowRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {favPlayers.length > 0 && (
            <Card className="p-4">
              <p className="mb-2.5 flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ink-3">
                <UserRound className="size-3" aria-hidden /> Your players
              </p>
              <ul className="space-y-2">
                {favPlayers.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link to={playerPathFor(p)} className="group flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-surface-2">
                      <Avatar name={p.name} photoUrl={p.photoUrl} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui font-semibold text-ink">{p.name}</span>
                        <span className="block text-label text-ink-3">
                          {p.role} · {getTeam(p.teamId).short}
                        </span>
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {reading.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ink-3">
            <BookmarkCheck className="size-3" aria-hidden /> Continue reading
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {reading.map((b) => (
              <Link key={b.refId} to={b.path} className="group rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong">
                <span className="font-mono text-micro uppercase tracking-wider text-ink-3">{b.kind === "intel" ? "Intelligence" : "News"}</span>
                <span className="mt-1 block text-ui font-semibold leading-snug text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {b.title}
                </span>
                <span className="mt-1.5 block text-micro text-ink-3">
                  Saved {agoFromMinutes((Date.now() - new Date(b.savedAt).getTime()) / 60000)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {viewed.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ink-3">
            <Clock3 className="size-3" aria-hidden /> Recently viewed
          </p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {viewed.map((r) => (
              <Link
                key={r.path}
                to={r.path}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-caption text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                {r.label}
              </Link>
            ))}
            {lastPlayer && (
              <Link
                to={`/similar/${lastPlayer.id}`}
                className="shrink-0 rounded-full border border-iq/35 bg-iq-soft px-3 py-1.5 text-caption font-medium text-iq-ink transition-colors hover:border-iq/60"
              >
                Because you viewed {lastPlayer.label}: find similar →
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
