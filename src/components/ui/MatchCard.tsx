import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getTeam } from "@/lib/repositories/teams";
import type { Match } from "@/data/types";
import { Crest } from "./Crest";
import { Badge } from "./Badge";
import { Card } from "./Card";

/** Fixture/result/live strip used across Home, Matches and Team pages. */
export function MatchCard({ match, className, dense = false }: { match: Match; className?: string; dense?: boolean }) {
  const navigate = useNavigate();
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const live = match.status === "live";
  const played = match.status !== "upcoming";

  return (
    <Card hover onClick={() => navigate(`/match/${match.id}`)} className={cn(dense ? "p-3" : "p-4", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10.5px] uppercase tracking-wider text-ink-3">{match.competition}</span>
        {live ? (
          <Badge variant="live">{match.minute}'</Badge>
        ) : (
          <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{match.kickoff}</span>
        )}
      </div>
      <div className="space-y-2">
        {[
          { team: home, score: match.homeScore },
          { team: away, score: match.awayScore },
        ].map(({ team, score }) => (
          <div key={team.id} className="flex items-center gap-2.5">
            <Crest teamId={team.id} size={dense ? 22 : 26} />
            <span className={cn("truncate text-[13.5px] font-semibold", played ? "text-ink" : "text-ink-2")}>{team.short}</span>
            {played && (
              <span className={cn("tabular ml-auto font-display text-lg font-bold", live ? "text-accent-ink" : "text-ink")}>{score}</span>
            )}
          </div>
        ))}
      </div>
      {match.headline && !dense && <p className="mt-2.5 truncate border-t border-line pt-2 text-xs text-ink-3">{match.headline}</p>}
    </Card>
  );
}
