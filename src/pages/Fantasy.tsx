import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, ArrowDownRight, ArrowUpRight, Crown, Gem, Stethoscope } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { StatTile } from "@/components/ui/StatTile";
import { IQTag } from "@/components/ui/IQInsight";
import { DataState } from "@/components/ui/DataState";
import { useFantasyState } from "@/lib/repositories/fantasy";
import { usePlayersState } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { playerPathFor, teamPathFor } from "@/lib/slug-builders";
import { kickoffLabel } from "@/lib/kickoff";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";
import type { FantasyBoard, Player } from "@/data/types";

/** FPL's fixture difficulty scale: 1–2 easy, 3 neutral, 4–5 hard. */
const fdrColor = (v: number) => (v <= 2 ? "bg-accent-soft text-accent-ink" : v === 3 ? "bg-surface-3 text-ink-2" : "bg-bad/12 text-bad");

export default function Fantasy() {
  usePageMeta(staticPageMeta["/fantasy"]);
  const { data: board, status: boardStatus } = useFantasyState();
  const { data: players, status: playerStatus } = usePlayersState();

  if (!board || players.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader level={1} eyebrow="Fantasy Premier League" title="Fantasy Assistant" />
        <DataState
          status={!board ? boardStatus : playerStatus}
          empty
          loadingLabel="Loading FPL data…"
          emptyTitle="FPL data hasn't synced yet"
          emptyBody="Gameweek and player data come from the official Fantasy Premier League API and sync hourly."
        />
      </div>
    );
  }
  return <FantasyView board={board} players={players} />;
}

function FantasyView({ board, players }: { board: FantasyBoard; players: Player[] }) {
  const navigate = useNavigate();
  const gw = board.gameweek;

  const picks = useMemo(() => {
    const available = players.filter((p) => p.availability === "available");
    const byXp = [...available].sort((a, b) => b.fantasy.expectedPoints - a.fantasy.expectedPoints);
    return {
      captains: byXp.slice(0, 3),
      differentials: byXp.filter((p) => p.fantasy.selectedBy < 10).slice(0, 3),
      transfersIn: [...players].sort((a, b) => b.fantasy.transfersIn - a.fantasy.transfersIn).slice(0, 3),
      transfersOut: [...players].sort((a, b) => b.fantasy.transfersOut - a.fantasy.transfersOut).slice(0, 3),
      alerts: players
        .filter((p) => p.availability !== "available" && p.fantasy.selectedBy >= 5)
        .sort((a, b) => b.fantasy.selectedBy - a.fantasy.selectedBy)
        .slice(0, 5),
    };
  }, [players]);

  const nextFixture = (teamId: string) => board.fixtureDifficulty.find((f) => f.teamId === teamId)?.fixtures.find((f) => f.gameweek === gw.number);
  const gameweeks = [...new Set(board.fixtureDifficulty.flatMap((t) => t.fixtures.map((f) => f.gameweek)))].sort((a, b) => a - b);
  const grid = [...board.fixtureDifficulty]
    .map((t) => ({ ...t, avg: t.fixtures.reduce((s, f) => s + f.difficulty, 0) / Math.max(1, t.fixtures.length) }))
    .sort((a, b) => a.avg - b.avg);

  return (
    <div className="space-y-8">
      <SectionHeader
        level={1}
        eyebrow={`Gameweek ${gw.number}`}
        title="Fantasy Assistant"
        action={
          <Badge variant="neutral" className="px-3 py-1.5">
            <AlarmClock className="size-3.5" aria-hidden /> Deadline {kickoffLabel(gw.deadlineIso)}
          </Badge>
        }
      />
      <p className="-mt-5 font-mono text-micro uppercase tracking-wider text-ink-3">Source: official Fantasy Premier League data · refreshed hourly</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {gw.averageScore != null && <StatTile label={`GW${gw.number - 1} average`} value={gw.averageScore} suffix=" pts" />}
        {gw.highestScore != null && <StatTile label={`GW${gw.number - 1} highest`} value={gw.highestScore} suffix=" pts" />}
        <StatTile label="Players flagged" value={players.filter((p) => p.availability !== "available").length} />
        <StatTile label="Players listed" value={players.length} />
      </div>

      <section aria-label="Captain picks">
        <SectionHeader title="Captain Candidates" action={<IQTag>FPL projection</IQTag>} />
        <div className="grid gap-3 md:grid-cols-3">
          {picks.captains.map((p, i) => (
            <PickCard key={p.id} p={p} top={i === 0} fixture={nextFixture(p.teamId)} onOpen={() => navigate(playerPathFor(p))} />
          ))}
        </div>
        <p className="mt-2 text-caption text-ink-3">
          Ranked by FPL's own expected points for gameweek {gw.number} (available players only). It's the Premier League's model, not FootIQ's — and a projection, not a result.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Transfer trends">
          <SectionHeader eyebrow="What FPL managers are doing this gameweek" title="Transfer Trends" />
          <div className="space-y-2.5">
            {picks.transfersIn.map((p) => (
              <TrendRow key={`in-${p.id}`} p={p} dir="in" count={p.fantasy.transfersIn} onOpen={() => navigate(playerPathFor(p))} />
            ))}
            {picks.transfersOut.map((p) => (
              <TrendRow key={`out-${p.id}`} p={p} dir="out" count={p.fantasy.transfersOut} onOpen={() => navigate(playerPathFor(p))} />
            ))}
          </div>
        </section>

        <section aria-label="Injury alerts and differentials">
          <SectionHeader title="Alerts & Differentials" />
          <div className="space-y-2.5">
            {picks.alerts.map((p) => (
              <Card key={p.id} className="flex items-start gap-3 p-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-bad/10 text-bad">
                  <Stethoscope className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-ui font-bold text-ink">
                    <Link to={playerPathFor(p)} className="hover:underline">
                      {p.name}
                    </Link>{" "}
                    <span className="ml-1 font-mono text-label font-medium text-ink-3">{p.fantasy.selectedBy}% owned</span>
                  </p>
                  <p className="mt-0.5 text-caption leading-snug text-ink-2">{p.news || p.availability}</p>
                </div>
              </Card>
            ))}
            {picks.differentials.map((p) => (
              <Card hover key={p.id} onClick={() => navigate(playerPathFor(p))} className="flex items-start gap-3 p-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-iq-soft text-iq-ink">
                  <Gem className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-bold text-ink">
                    {p.name}{" "}
                    <span className="ml-1 font-mono text-label text-ink-3">
                      {p.fantasy.selectedBy}% owned · {p.fantasy.expectedPoints.toFixed(1)} FPL xPts · £{p.fantasy.price.toFixed(1)}m
                    </span>
                  </p>
                  <p className="mt-0.5 text-caption leading-snug text-ink-2">
                    Under 10% owned with one of the higher FPL projections this gameweek.
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <section aria-label="Fixture difficulty">
        <SectionHeader eyebrow="Next five gameweeks · FPL difficulty" title="Fixture Difficulty" />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-ui">
            <thead>
              <tr className="border-b border-line text-left font-mono text-micro uppercase tracking-wider text-ink-3">
                <th scope="col" className="py-2.5 pl-4 font-medium">Team</th>
                {gameweeks.map((n) => (
                  <th key={n} scope="col" className="text-center font-medium">GW{n}</th>
                ))}
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((t) => {
                const team = getTeam(t.teamId);
                return (
                  <tr
                    key={t.teamId}
                    onClick={() => navigate(teamPathFor(team))}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(teamPathFor(team));
                      }
                    }}
                    aria-label={`${team.short} team page`}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <td className="py-2.5 pl-4">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <Crest teamId={t.teamId} size={20} />
                        {team.short}
                      </span>
                    </td>
                    {gameweeks.map((n) => {
                      const games = t.fixtures.filter((f) => f.gameweek === n);
                      return (
                        <td key={n} className="text-center">
                          {games.length === 0 ? (
                            <span className="font-mono text-label text-ink-3">—</span>
                          ) : (
                            games.map((f, i) => (
                              <span
                                key={i}
                                className={cn("mx-auto my-0.5 block w-14 rounded-md py-1 text-center font-mono text-label font-bold", fdrColor(f.difficulty))}
                                title={`Difficulty ${f.difficulty}/5`}
                              >
                                {getTeam(f.opponentId).tla} {f.home ? "H" : "A"}
                              </span>
                            ))
                          )}
                        </td>
                      );
                    })}
                    <td className="tabular py-2.5 pr-4 text-right font-mono text-xs font-semibold text-ink-2">{t.avg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 font-mono text-micro uppercase tracking-wider text-ink-3">1–2 easy · 3 neutral · 4–5 hard · FPL's official fixture difficulty rating</p>
      </section>
    </div>
  );
}

function PickCard({ p, top, fixture, onOpen }: { p: Player; top: boolean; fixture?: FantasyBoard["fixtureDifficulty"][number]["fixtures"][number]; onOpen: () => void }) {
  return (
    <Card hover onClick={onOpen} className={cn("relative overflow-hidden p-4 md:p-5", top && "border-iq/40")}>
      {top && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-iq px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-wider text-[#241a02]">
          <Crown className="size-3" aria-hidden /> Top projection
        </span>
      )}
      <div className="flex items-center gap-3">
        <Avatar name={p.name} photoUrl={p.photoUrl} size={46} ringColor={getTeam(p.teamId).colors[0]} />
        <div>
          <p className="text-body font-bold text-ink">{p.name}</p>
          <p className="flex items-center gap-1.5 text-label text-ink-3">
            <Crest teamId={p.teamId} size={15} /> {getTeam(p.teamId).short} · £{p.fantasy.price.toFixed(1)}m
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3.5 text-center">
        <div>
          <p className="eyebrow">FPL xPts</p>
          <p className="tabular mt-0.5 font-display text-lg font-bold text-iq-ink">{p.fantasy.expectedPoints.toFixed(1)}</p>
        </div>
        <div>
          <p className="eyebrow">Owned</p>
          <p className="tabular mt-0.5 font-display text-lg font-bold text-ink">{p.fantasy.selectedBy}%</p>
        </div>
        <div>
          <p className="eyebrow">Next</p>
          {fixture ? (
            <p className={cn("mx-auto mt-1 w-14 rounded-md py-0.5 font-mono text-caption font-bold", fdrColor(fixture.difficulty))}>
              {getTeam(fixture.opponentId).tla} {fixture.home ? "H" : "A"}
            </p>
          ) : (
            <p className="mt-1 font-mono text-caption text-ink-3">—</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-caption leading-relaxed text-ink-2">
        {p.fantasy.form.toFixed(1)} form · {p.fantasy.totalPoints} points · {p.stats.goals}G {p.stats.assists}A this season.
      </p>
    </Card>
  );
}

function TrendRow({ p, dir, count, onOpen }: { p: Player; dir: "in" | "out"; count: number; onOpen: () => void }) {
  return (
    <Card hover onClick={onOpen} className="flex items-center gap-3 p-3.5">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", dir === "in" ? "bg-accent-soft text-accent-ink" : "bg-bad/10 text-bad")}>
        {dir === "in" ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ui font-bold text-ink">{p.name}</p>
        <p className="mt-0.5 text-caption text-ink-2">
          {count.toLocaleString()} managers transferred {dir === "in" ? "in" : "out"} this gameweek · {getTeam(p.teamId).short}
        </p>
      </div>
    </Card>
  );
}
