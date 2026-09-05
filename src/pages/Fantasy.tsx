import { useNavigate } from "react-router-dom";
import { AlarmClock, ArrowDownRight, ArrowUpRight, Crown, Gem, Stethoscope } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { StatTile } from "@/components/ui/StatTile";
import { IQInsight } from "@/components/ui/IQInsight";
import { gameweek, captainPicks, differentials, transferTips, injuryAlerts, fixtureDifficulty } from "@/lib/repositories/fantasy";
import { getPlayer } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { DemoDataNotice } from "@/components/ui/DemoDataNotice";

const fdrColor = (v: number) =>
  v <= 2 ? "bg-accent-soft text-accent-ink" : v === 3 ? "bg-surface-3 text-ink-2" : "bg-bad/12 text-bad";

export default function Fantasy() {
  usePageMeta({
    title: "Fantasy Assistant",
    description: "AI captain picks, transfer calls, injury alerts, differentials and a five-week fixture-difficulty matrix for fantasy managers.",
    path: "/fantasy",
  });
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <SectionHeader
        level={1}
        eyebrow={`Gameweek ${gameweek.number}`}
        title="Fantasy Assistant"
        action={
          <Badge variant="warn" className="px-3 py-1.5">
            <AlarmClock className="size-3.5" aria-hidden /> Deadline {gameweek.deadline}
          </Badge>
        }
      />
      <DemoDataNotice
        domain="fantasy"
        detail="Gameweek, scores, picks and deadlines here are illustrative sample data. FootIQ is not connected to an FPL account or a fantasy data provider."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Your GW score" value={gameweek.yourScore} delta={gameweek.yourScore - gameweek.averageScore} deltaSuffix=" vs avg" />
        <StatTile label="Average score" value={gameweek.averageScore} />
        <Card className="px-4 py-3.5">
          <p className="eyebrow">Overall rank</p>
          <p className="tabular mt-1 font-display text-figure font-bold leading-none text-ink">{gameweek.overallRank}</p>
          <p className="tabular mt-1 font-mono text-label text-accent-ink">↑ {gameweek.rankMove.toLocaleString()} places</p>
        </Card>
        <StatTile label="GW32 projected" value={71} suffix=" pts" />
      </div>

      <section aria-label="Captain picks">
        <SectionHeader title="Captain Picks" />
        <div className="grid gap-3 md:grid-cols-3">
          {captainPicks.map((c, i) => {
            const p = getPlayer(c.playerId);
            return (
              <Card hover key={c.playerId} onClick={() => navigate(`/player/${c.playerId}`)} className={cn("relative overflow-hidden p-4 md:p-5", i === 0 && "border-iq/40")}>
                {i === 0 && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-iq px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-wider text-[#241a02]">
                    <Crown className="size-3" aria-hidden /> Top pick
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} playerId={p.id} size={46} ringColor={getTeam(p.teamId).colors[0]} />
                  <div>
                    <p className="text-body font-bold text-ink">{p.name}</p>
                    <p className="flex items-center gap-1.5 text-label text-ink-3">
                      <Crest teamId={p.teamId} size={15} /> {getTeam(p.teamId).short}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3.5 text-center">
                  <div>
                    <p className="eyebrow">xPts</p>
                    <p className="tabular mt-0.5 font-display text-lg font-bold text-accent-ink">{c.expectedPoints.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="eyebrow">Owned</p>
                    <p className="tabular mt-0.5 font-display text-lg font-bold text-ink">{c.ownership}%</p>
                  </div>
                  <div>
                    <p className="eyebrow">Fixture</p>
                    <p className={cn("mx-auto mt-1 w-8 rounded-md py-0.5 font-mono text-caption font-bold", fdrColor(6 - c.fixtureEase))}>{c.fixtureEase}/5</p>
                  </div>
                </div>
                <p className="mt-3 text-caption leading-relaxed text-ink-2">{c.note}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Transfer recommendations">
          <SectionHeader title="Transfer Calls" />
          <div className="space-y-2.5">
            {transferTips.in.map((t) => {
              const p = getPlayer(t.playerId);
              return (
                <Card hover key={`in-${t.playerId}`} onClick={() => navigate(`/player/${t.playerId}`)} className="flex items-center gap-3 p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                    <ArrowUpRight className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-bold text-ink">Bring in {p.name}</p>
                    <p className="mt-0.5 text-caption leading-snug text-ink-2">{t.reason}</p>
                  </div>
                </Card>
              );
            })}
            {transferTips.out.map((t) => {
              const p = getPlayer(t.playerId);
              return (
                <Card hover key={`out-${t.playerId}`} onClick={() => navigate(`/player/${t.playerId}`)} className="flex items-center gap-3 p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bad/10 text-bad">
                    <ArrowDownRight className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-bold text-ink">Move on {p.name}</p>
                    <p className="mt-0.5 text-caption leading-snug text-ink-2">{t.reason}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-label="Injury alerts and differentials">
          <SectionHeader title="Alerts & Differentials" />
          <div className="space-y-2.5">
            {injuryAlerts.map((a) => {
              const p = getPlayer(a.playerId);
              return (
                <Card key={a.playerId} className="flex items-start gap-3 p-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/12 text-warn">
                    <Stethoscope className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-ui font-bold text-ink">
                      {p.name} <span className="ml-1 font-mono text-label font-medium text-iq-ink">{a.status}</span>
                    </p>
                    <p className="mt-0.5 text-caption leading-snug text-ink-2">{a.note}</p>
                  </div>
                </Card>
              );
            })}
            {differentials.map((d) => {
              const p = getPlayer(d.playerId);
              return (
                <Card hover key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)} className="flex items-start gap-3 p-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-iq-soft text-iq-ink">
                    <Gem className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-bold text-ink">
                      {p.name} <span className="ml-1 font-mono text-label text-ink-3">{d.ownership}% owned · {d.expectedPoints.toFixed(1)} xPts</span>
                    </p>
                    <p className="mt-0.5 text-caption leading-snug text-ink-2">{d.note}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </div>

      <section aria-label="Fixture difficulty">
        <SectionHeader eyebrow="Next five gameweeks" title="Fixture Difficulty" />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-ui">
            <thead>
              <tr className="border-b border-line text-left font-mono text-micro uppercase tracking-wider text-ink-3">
                <th scope="col" className="py-2.5 pl-4 font-medium">Team</th>
                {[32, 33, 34, 35, 36].map((gw) => (
                  <th key={gw} scope="col" className="text-center font-medium">GW{gw}</th>
                ))}
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fixtureDifficulty).map(([teamId, diffs]) => {
                const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
                return (
                  <tr
                    key={teamId}
                    onClick={() => navigate(`/team/${teamId}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/team/${teamId}`);
                      }
                    }}
                    aria-label={`${getTeam(teamId).short} team page`}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <td className="py-2.5 pl-4">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <Crest teamId={teamId} size={20} />
                        {getTeam(teamId).short}
                      </span>
                    </td>
                    {diffs.map((d, i) => (
                      <td key={i} className="text-center">
                        <span className={cn("mx-auto inline-block w-8 rounded-md py-1 text-center font-mono text-label font-bold", fdrColor(d))}>{d}</span>
                      </td>
                    ))}
                    <td className="tabular py-2.5 pr-4 text-right font-mono text-xs font-semibold text-ink-2">{avg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 font-mono text-micro uppercase tracking-wider text-ink-3">1 = easiest · 5 = hardest · FootIQ difficulty blends opponent strength, venue and rest days</p>
      </section>

      <IQInsight title="This week's chip call" feedback="Fantasy chip call">
        Hold the Bench Boost. GW34 doubles for six of your eight assets and the fixture-difficulty average drops from 3.1 to 2.2 — model
        expects +11 points from waiting two weeks. Patience is a differential too.
      </IQInsight>
    </div>
  );
}
