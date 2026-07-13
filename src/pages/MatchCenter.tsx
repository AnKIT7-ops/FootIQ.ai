import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeftRight, CircleAlert, Goal, RectangleVertical, Repeat, Sparkles, Timer } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { IQInsight } from "@/components/ui/IQInsight";
import { Meter } from "@/components/ui/StatTile";
import { MomentumRiver } from "@/components/charts/MomentumRiver";
import { CompareBars } from "@/components/charts/CompareBars";
import { Formation } from "@/components/charts/Formation";
import { Heatmap } from "@/components/charts/Heatmap";
import { matchDetail } from "@/lib/repositories/matches";
import { getTeam } from "@/lib/repositories/teams";
import { heatmapFor } from "@/data/generators";
import { cn } from "@/lib/utils";
import { sportsEventJsonLd, usePageMeta } from "@/lib/seo";
import { matchPath, predictionPath, resolveMatch } from "@/lib/slugs";
import { ShareBar } from "@/components/ui/ShareBar";
import type { MatchEvent } from "@/data/types";

const eventIcon = (e: MatchEvent) => {
  switch (e.type) {
    case "goal":
    case "own-goal":
    case "penalty":
      return <Goal className="size-3.5" aria-hidden />;
    case "yellow":
      return <RectangleVertical className="size-3.5 fill-warn text-warn" aria-hidden />;
    case "red":
      return <RectangleVertical className="size-3.5 fill-bad text-bad" aria-hidden />;
    case "sub":
      return <Repeat className="size-3.5" aria-hidden />;
    case "var":
      return <CircleAlert className="size-3.5" aria-hidden />;
    default:
      return <Timer className="size-3.5" aria-hidden />;
  }
};

export default function MatchCenter() {
  const { id } = useParams();
  const detail = useMemo(() => {
    try {
      return matchDetail(resolveMatch(id)?.id ?? id ?? "ars-liv");
    } catch {
      return matchDetail("ars-liv");
    }
  }, [id]);
  const [tab, setTab] = useState("overview");
  const home = getTeam(detail.homeId);
  const away = getTeam(detail.awayId);
  const live = detail.status === "live";
  usePageMeta({
    title:
      detail.homeScore != null && detail.awayScore != null
        ? `${home.short} ${detail.homeScore}–${detail.awayScore} ${away.short}`
        : `${home.short} vs ${away.short}`,
    description: `${home.name} vs ${away.name} — live momentum, xG, lineups, AI commentary and win probability in the FootIQ Match Center.`,
    path: matchPath(detail),
    jsonLd: sportsEventJsonLd({ home: home.name, away: away.name, kickoff: detail.kickoff, venue: detail.venue, path: matchPath(detail) }),
    breadcrumbs: [
      { name: "Matches", path: "/matches" },
      { name: `${home.short} vs ${away.short}`, path: matchPath(detail) },
    ],
  });

  const homeHeat = useMemo(() => heatmapFor(detail.id + home.id, "FW", "Striker"), [detail.id, home.id]);
  const awayHeat = useMemo(() => heatmapFor(detail.id + away.id, "FW", "Left Winger"), [detail.id, away.id]);

  const ratings = [...detail.homeLineup.players.map((p) => ({ ...p, teamId: home.id })), ...detail.awayLineup.players.map((p) => ({ ...p, teamId: away.id }))]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="floodlight card relative overflow-hidden p-5 md:p-7">
        <div className="flex flex-wrap items-center gap-2">
          {live ? <Badge variant="live">Live · {detail.minute}'</Badge> : <Badge>{detail.status === "finished" ? "Full-time" : detail.kickoff}</Badge>}
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            {detail.competition} · {detail.venue}
          </span>
        </div>
        <div className="mt-5 flex items-center justify-center gap-5 md:gap-10">
          <Link to={`/team/${home.id}`} className="flex flex-1 items-center justify-end gap-3 text-right">
            <span className="hidden max-w-[10rem] truncate text-lg font-bold text-ink md:block">{home.short}</span>
            <Crest teamId={home.id} size={52} />
          </Link>
          <p className="display shrink-0 text-5xl font-black text-ink md:text-6xl">
            {detail.homeScore ?? "–"}
            <span className="mx-2.5 text-ink-3 md:mx-3.5">:</span>
            {detail.awayScore ?? "–"}
          </p>
          <Link to={`/team/${away.id}`} className="flex flex-1 items-center gap-3">
            <Crest teamId={away.id} size={52} />
            <span className="hidden max-w-[10rem] truncate text-lg font-bold text-ink md:block">{away.short}</span>
          </Link>
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-ink-3 md:hidden">
          {home.short} vs {away.short}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <ShareBar
            title={`${home.short} vs ${away.short}`}
            path={matchPath(detail)}
            kind={detail.competition}
            stat={detail.homeScore != null && detail.awayScore != null ? `${detail.homeScore}–${detail.awayScore}` : `xG ${detail.home.xG.toFixed(2)} vs ${detail.away.xG.toFixed(2)}`}
          />
          <Link
            to={predictionPath(detail)}
            className="inline-flex items-center gap-1.5 rounded-full border border-iq/30 bg-iq-soft px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-iq-ink transition-colors hover:border-iq/60"
          >
            AI prediction
          </Link>
        </div>
      </motion.div>

      <Tabs
        id="match"
        className="w-full justify-start"
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "stats", label: "Stats" },
          { value: "lineups", label: "Lineups" },
          { value: "iq", label: "FootIQ" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="Pressure map" title="Momentum" className="mb-3" />
              <MomentumRiver data={detail.momentum} homeLabel={home.short} awayLabel={away.short} />
            </Card>

            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="Key numbers" title="Match Stats" className="mb-4" />
              <CompareBars
                rows={[
                  { label: "Expected goals (xG)", a: detail.home.xG, b: detail.away.xG, format: (v) => v.toFixed(2) },
                  { label: "Shots", a: detail.home.shots, b: detail.away.shots },
                  { label: "On target", a: detail.home.shotsOnTarget, b: detail.away.shotsOnTarget },
                  { label: "Big chances", a: detail.home.bigChances, b: detail.away.bigChances },
                  { label: "Corners", a: detail.home.corners, b: detail.away.corners },
                ]}
              />
              <div className="mt-5 border-t border-line pt-4">
                <PossessionBar homeName={home.short} awayName={away.short} home={detail.home.possession} away={detail.away.possession} />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="As it happened" title="Timeline" className="mb-3" />
              <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[1.05rem] before:top-1 before:w-px before:bg-line">
                {[...detail.events].reverse().map((e, i) => (
                  <li key={i} className="relative flex gap-3 pl-0">
                    <span
                      className={cn(
                        "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2",
                        (e.type === "goal" || e.type === "penalty") && "border-accent/40 bg-accent-soft text-accent-ink",
                      )}
                    >
                      {eventIcon(e)}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                        {e.minute}'{e.teamId ? ` · ${getTeam(e.teamId).tla}` : ""}
                        {e.player ? ` · ${e.player}` : ""}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{e.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="Complete sheet" title="All Stats" className="mb-4" />
            <CompareBars
              rows={[
                { label: "Possession %", a: detail.home.possession, b: detail.away.possession, max: 100 },
                { label: "Expected goals (xG)", a: detail.home.xG, b: detail.away.xG, format: (v) => v.toFixed(2) },
                { label: "Passes", a: detail.home.passes, b: detail.away.passes },
                { label: "Pass accuracy %", a: detail.home.passAccuracy, b: detail.away.passAccuracy, max: 100 },
                { label: "Shots", a: detail.home.shots, b: detail.away.shots },
                { label: "On target", a: detail.home.shotsOnTarget, b: detail.away.shotsOnTarget },
                { label: "Tackles", a: detail.home.tackles, b: detail.away.tackles },
                { label: "Saves", a: detail.home.saves, b: detail.away.saves },
                { label: "Fouls", a: detail.home.fouls, b: detail.away.fouls },
              ]}
            />
          </Card>
          <div className="space-y-6">
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow={`${home.short} attack zones`} title="Territory" className="mb-3" />
              <Heatmap cells={homeHeat} />
            </Card>
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow={`${away.short} attack zones`} title="Territory" className="mb-3" />
              <Heatmap cells={awayHeat} />
            </Card>
          </div>
        </div>
      )}

      {tab === "lineups" && (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">
                {home.short} · {detail.homeLineup.formation}
              </p>
              <p className="eyebrow">
                {away.short} · {detail.awayLineup.formation}
              </p>
            </div>
            <Formation
              home={detail.homeLineup.players}
              away={detail.awayLineup.players}
              homeColor={home.colors[0]}
              awayColor={away.colors[0] === home.colors[0] ? away.colors[1] : away.colors[0]}
            />
            <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-wide text-ink-3">
              Hover players for ratings · {home.tla} attacks →
            </p>
          </Card>
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="FootIQ ratings" title="Top Performers" className="mb-3" />
            <ol className="space-y-2.5">
              {ratings.map((p, i) => (
                <li key={`${p.teamId}-${p.shirt}`} className="flex items-center gap-3">
                  <span className="w-4 text-center font-mono text-[11px] text-ink-3">{i + 1}</span>
                  <span className="relative">
                    <Avatar name={p.name} playerId={p.playerId} size={30} />
                    <Crest teamId={p.teamId} size={14} className="absolute -bottom-0.5 -right-1" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {p.playerId ? (
                      <Link to={`/player/${p.playerId}`} className="truncate text-[13.5px] font-semibold text-ink hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="truncate text-[13.5px] font-semibold text-ink">{p.name}</span>
                    )}
                    <p className="text-[10.5px] uppercase tracking-wide text-ink-3">{p.pos}</p>
                  </div>
                  <span
                    className={cn(
                      "tabular rounded-lg px-2 py-0.5 font-mono text-[12.5px] font-bold",
                      p.rating >= 7.5 ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-ink-2",
                    )}
                  >
                    {p.rating.toFixed(1)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {tab === "iq" && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <IQInsight title="Tactical read" feedback="Match tactical read">{detail.tacticalNote}</IQInsight>
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="Live model feed" title="AI Commentary" className="mb-3" />
              <ol className="space-y-4">
                {[...detail.aiCommentary].reverse().map((c, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-iq-soft text-iq-ink">
                      <Sparkles className="size-3.5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                        {c.minute}' · {c.kind}
                      </p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="Model estimate" title="Win Probability" className="mb-4" />
              <WinProb home={home.short} away={away.short} detail={{ h: live ? 64 : 45, d: live ? 22 : 26, a: live ? 14 : 29 }} />
            </Card>
            <IQInsight compact title="What decides it">
              Set pieces: {home.short} lead the league in corner conversion while {away.short} rank bottom-six defending them. Expect the
              next dead ball inside 25m to swing win probability by up to 9%.
            </IQInsight>
          </div>
        </div>
      )}
    </div>
  );
}

function PossessionBar({ homeName, awayName, home, away }: { homeName: string; awayName: string; home: number; away: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-[11px] text-ink-2">
        <span>
          {homeName} <strong className="text-ink">{home}%</strong>
        </span>
        <span className="uppercase tracking-wider text-ink-3">Possession</span>
        <span>
          <strong className="text-ink">{away}%</strong> {awayName}
        </span>
      </div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        <div className="rounded-l-full bg-chart-1" style={{ width: `${home}%` }} />
        <div className="rounded-r-full bg-chart-4" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}

function WinProb({ home, away, detail }: { home: string; away: string; detail: { h: number; d: number; a: number } }) {
  const rows = [
    { label: home, v: detail.h, color: "var(--chart-1)" },
    { label: "Draw", v: detail.d, color: "var(--ink-3)" },
    { label: away, v: detail.a, color: "var(--chart-4)" },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Meter key={r.label} label={r.label} value={r.v} color={r.color} />
      ))}
      <p className="pt-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
        <ArrowLeftRight className="mr-1 inline size-3" aria-hidden />
        Updates every event · probabilities, not promises
      </p>
    </div>
  );
}
