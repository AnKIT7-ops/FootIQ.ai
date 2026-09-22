import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Crest } from "@/components/ui/Crest";
import { Badge } from "@/components/ui/Badge";
import { Meter } from "@/components/ui/StatTile";
import { DataState } from "@/components/ui/DataState";
import { AiAnswer } from "@/components/ui/AiAnswer";
import { useMatchesState } from "@/lib/repositories/matches";
import { useTeams } from "@/lib/repositories/teams";
import { forecastFixture, type Forecast } from "@/lib/forecast";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { kickoffLabel, kickoffTime } from "@/lib/kickoff";
import type { Match, Team } from "@/data/types";

/** Fixtures shown per competition — the next matchday or so. */
const PER_COMPETITION = 12;

export default function Predictions() {
  usePageMeta({
    title: "Match Predictions",
    description: "Win/draw/loss probabilities, expected goals and likeliest scorelines for upcoming fixtures — computed from this season's league tables, with the inputs shown.",
    path: "/predictions",
  });
  const { data: grouped, status } = useMatchesState();
  const teams = useTeams();
  const [params, setParams] = useSearchParams();

  // Domestic fixtures the model can price, soonest first.
  const priced = useMemo(
    () =>
      grouped.upcoming
        .map((m) => ({ m, f: forecastFixture(m, teams) }))
        .filter((x): x is { m: Match; f: Extract<ReturnType<typeof forecastFixture>, { ok: true }> } => x.f.ok)
        .sort((a, b) => a.m.kickoffIso.localeCompare(b.m.kickoffIso)),
    [grouped.upcoming, teams],
  );
  const competitions = useMemo(() => [...new Set(priced.map((x) => x.m.competition))], [priced]);

  const requested = params.get("match");
  const requestedMatch = requested ? grouped.upcoming.find((m) => m.id === requested) : undefined;
  const competition = params.get("league") ?? requestedMatch?.competition ?? (competitions.includes("Premier League") ? "Premier League" : competitions[0]);
  const list = priced.filter((x) => x.m.competition === competition).slice(0, PER_COMPETITION);
  const active = priced.find((x) => x.m.id === requested) ?? list[0];

  const select = (next: { league?: string; match?: string }) => {
    const p = new URLSearchParams(params);
    if (next.league !== undefined) {
      p.set("league", next.league);
      p.delete("match");
    }
    if (next.match !== undefined) p.set("match", next.match);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Probabilities, not promises" title="Predictions" />
      <p className="max-w-3xl text-ui text-ink-2">
        Every number below is computed from this season&apos;s real league tables — goals scored and conceded per game — with a
        Poisson goals model. <span className="text-accent-ink">Emerald</span> is the measured input,{" "}
        <span className="text-iq-ink">amber</span> is the model&apos;s estimate.
      </p>

      {status !== "ready" || priced.length === 0 ? (
        <DataState
          status={status}
          empty={priced.length === 0}
          emptyTitle="No fixtures to forecast"
          emptyBody="There are no upcoming domestic-league fixtures in the synced window. Cup and Champions League ties aren't priced — different leagues' tables don't compare."
        />
      ) : (
        <>
          {competitions.length > 1 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6" role="tablist" aria-label="Competition">
              {competitions.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={c === competition}
                  onClick={() => select({ league: c })}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-caption font-semibold transition-colors",
                    c === competition ? "border-accent/50 bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:text-ink",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
            {list.map(({ m, f }) => {
              const selected = m.id === active?.m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => select({ match: m.id })}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-2.5 transition-colors",
                    selected ? "border-iq/50 bg-iq-soft" : "border-line bg-surface hover:border-line-strong",
                  )}
                  aria-pressed={selected}
                >
                  <Crest teamId={f.home.id} size={22} />
                  <span className="font-mono text-label font-semibold text-ink">
                    {f.home.tla} v {f.away.tla}
                  </span>
                  <Crest teamId={f.away.id} size={22} />
                  <span className="font-mono text-micro text-ink-3">{kickoffLabel(m.kickoffIso)}</span>
                </button>
              );
            })}
          </div>

          {active && <ForecastView key={active.m.id} match={active.m} home={active.f.home} away={active.f.away} forecast={active.f.forecast} />}
        </>
      )}
    </div>
  );
}

function ForecastView({ match, home, away, forecast: f }: { match: Match; home: Team; away: Team; forecast: Forecast }) {
  const b = f.basis;
  const rows: [string, string, string][] = [
    ["Games played", String(b.home.played), String(b.away.played)],
    ["Goals scored / game", b.home.scoredPerGame.toFixed(2), b.away.scoredPerGame.toFixed(2)],
    ["Goals conceded / game", b.home.concededPerGame.toFixed(2), b.away.concededPerGame.toFixed(2)],
    ["League position", String(home.position), String(away.position)],
    ["Points", String(home.points), String(away.points)],
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Card className="floodlight p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Crest teamId={home.id} size={40} />
            <p className="display text-xl font-bold text-ink md:text-2xl">
              {home.short} <span className="text-ink-3">vs</span> {away.short}
            </p>
            <Crest teamId={away.id} size={40} />
            <Badge variant="iq" className="ml-auto">Model estimate</Badge>
          </div>

          <div
            className="flex h-11 w-full gap-[3px] overflow-hidden rounded-2xl"
            role="img"
            aria-label={`Model win probabilities: ${home.short} ${f.homeWin}%, draw ${f.draw}%, ${away.short} ${f.awayWin}%`}
          >
            <motion.div initial={{ flexBasis: 0 }} animate={{ flexBasis: `${f.homeWin}%` }} transition={{ duration: 0.6 }} className="flex items-center justify-center bg-chart-1 font-mono text-caption font-bold text-[#04110c]">
              {f.homeWin}%
            </motion.div>
            <motion.div initial={{ flexBasis: 0 }} animate={{ flexBasis: `${f.draw}%` }} transition={{ duration: 0.6 }} className="flex items-center justify-center bg-surface-3 font-mono text-caption font-bold text-ink-2">
              {f.draw}%
            </motion.div>
            <motion.div initial={{ flexBasis: 0 }} animate={{ flexBasis: `${f.awayWin}%` }} transition={{ duration: 0.6 }} className="flex items-center justify-center bg-chart-4 font-mono text-caption font-bold text-white">
              {f.awayWin}%
            </motion.div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-label text-ink-3">
            <span>{home.short} win</span>
            <span>Draw</span>
            <span>{away.short} win</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
            <div>
              <p className="eyebrow">Expected goals</p>
              <p className="tabular mt-1 font-display text-2xl font-bold text-iq-ink">
                {f.expectedHome.toFixed(1)}–{f.expectedAway.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="eyebrow">Over 2.5 goals</p>
              <p className="tabular mt-1 font-display text-2xl font-bold text-iq-ink">{f.over25}%</p>
            </div>
            <div>
              <p className="eyebrow">Both teams score</p>
              <p className="tabular mt-1 font-display text-2xl font-bold text-iq-ink">{f.btts}%</p>
            </div>
            <div>
              <p className="eyebrow">Kickoff</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{kickoffTime(match.kickoffIso)}</p>
              <Link to={`/match/${match.id}`} className="mt-0.5 inline-block font-mono text-micro uppercase tracking-wider text-accent-ink hover:underline">
                Match page →
              </Link>
            </div>
          </div>
        </Card>

        <AiAnswer endpoint={`/api/ai/fixtures/${encodeURIComponent(match.id)}/preview`} title="AI match preview" cta="Explain this forecast" feedback="Fixture preview" />
      </div>

      <div className="space-y-6">
        <Card className="p-4 md:p-5">
          <SectionHeader eyebrow="Measured · this season" title="What it's built from" className="mb-3" />
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-line text-left font-mono text-micro uppercase tracking-wider text-ink-3">
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Stat</span>
                </th>
                <th scope="col" className="py-2 text-right font-medium">{home.tla}</th>
                <th scope="col" className="py-2 text-right font-medium">{away.tla}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, h, a]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="py-2 text-ink-2">{label}</td>
                  <td className="tabular py-2 text-right font-mono text-accent-ink">{h}</td>
                  <td className="tabular py-2 text-right font-mono text-accent-ink">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-caption text-ink-3">
            {match.competition} average: <span className="tabular font-mono text-accent-ink">{b.leagueGoalsPerTeamGame.toFixed(2)}</span> goals per
            team per game.
            {Math.min(b.home.played, b.away.played) < 8 && " Early season — records are blended toward the league average so a couple of results can't dominate."}
          </p>
        </Card>

        <Card className="p-4 md:p-5">
          <SectionHeader eyebrow="Model estimate" title="Likeliest scores" className="mb-4" />
          <div className="space-y-3">
            {f.topScores.map((s) => (
              <Meter key={s.score} label={s.score} value={s.p} max={20} color="var(--chart-3)" />
            ))}
          </div>
        </Card>

        <Card className="p-4 text-caption leading-relaxed text-ink-3">
          How it works: each side&apos;s attack and defence are rated against the league average, adjusted for home advantage, and turned
          into goal probabilities. It doesn&apos;t know about injuries, suspensions or rotation. Probabilities, not guarantees — a 70%
          favourite still loses three times in ten.
        </Card>
      </div>
    </motion.div>
  );
}
