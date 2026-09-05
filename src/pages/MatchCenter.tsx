import { useEffect, useMemo, useState } from "react";
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
import { matchDetail, useMatchesState } from "@/lib/repositories/matches";
import { getTeam } from "@/lib/repositories/teams";
import { heatmapFor } from "@/data/generators";
import { cn } from "@/lib/utils";
import { sportsEventJsonLd, usePageMeta } from "@/lib/seo";
import { matchPath, predictionPath, resolveMatch } from "@/lib/slugs";
import { ShareBar } from "@/components/ui/ShareBar";
import type { MatchDetail, MatchEvent } from "@/data/types";
import { recordView } from "@/lib/recent";
import { kickoffLabel } from "@/lib/kickoff";
import { DemoDataNotice } from "@/components/ui/DemoDataNotice";
import { predictionByMatch } from "@/lib/repositories/predictions";
import { DemoEngineChip } from "@/components/ui/DemoEngineChip";
import { DataState } from "@/components/ui/DataState";

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

/**
 * Resolves the URL to a fixture, or renders "not found".
 *
 * An unresolvable id yields null, NOT the demo fixture. This used to fall back
 * to `matchDetail("ars-liv")` on any miss, so a stale link, a typo, or a
 * fixture that aged out of the sync window all rendered the hardcoded Arsenal
 * 2-1 Liverpool demo match — permanently live at 67' — as though it were that
 * URL's real match. The body is a separate component so its hooks stay
 * unconditional.
 */
export default function MatchCenter() {
  const { id } = useParams();
  const { data, status } = useMatchesState();
  const detail = useMemo(() => {
    const resolved = resolveMatch(id)?.id ?? id;
    if (!resolved) return null;
    try {
      return matchDetail(resolved);
    } catch {
      return null;
    }
    // `data` is not read here, but re-resolving after fixtures hydrate is the
    // point: on a cold load the id isn't known yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data]);

  if (!detail) {
    return (
      <div className="py-10">
        <DataState
          status={status}
          empty
          emptyTitle="Match not found"
          emptyBody="We don't have this fixture. It may have aged out of the window we sync, or the link may be stale."
        />
      </div>
    );
  }
  return <MatchBody detail={detail} />;
}

function MatchBody({ detail }: { detail: MatchDetail }) {
  const [tab, setTab] = useState("overview");
  const home = getTeam(detail.homeId);
  const away = getTeam(detail.awayId);
  const live = detail.status === "live";
  // Has a ball been kicked? Gates every section that describes actual play.
  const played = detail.status === "live" || detail.status === "finished";
  const prediction = predictionByMatch.get(detail.id);
  useEffect(() => {
    recordView({ kind: "match", id: detail.id, label: `${home.short} vs ${away.short}`, sub: "Match center", path: `/matches/${detail.id}` });
  }, [detail.id, home.short, away.short]);
  usePageMeta({
    title:
      detail.homeScore != null && detail.awayScore != null
        ? `${home.short} ${detail.homeScore}–${detail.awayScore} ${away.short}`
        : `${home.short} vs ${away.short}`,
    description: `${home.name} vs ${away.name} — live momentum, xG, lineups, AI commentary and win probability in the FootIQ Match Center.`,
    path: matchPath(detail),
    jsonLd: sportsEventJsonLd({ home: home.name, away: away.name, kickoffIso: detail.kickoffIso, venue: detail.venue, path: matchPath(detail) }),
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
        {/* The score is rendered as a figure, not a heading — screen readers get the fixture as the page's h1. */}
        <h1 className="sr-only">
          {detail.homeScore != null && detail.awayScore != null
            ? `${home.name} ${detail.homeScore}–${detail.awayScore} ${away.name}`
            : `${home.name} vs ${away.name}`}
          {" · "}
          {detail.competition}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {live ? <Badge variant="live">Live · {detail.minute}'</Badge> : <Badge>{detail.status === "finished" ? "Full-time" : kickoffLabel(detail.kickoffIso)}</Badge>}
          <span className="font-mono text-label uppercase tracking-wider text-ink-3">
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
        <p className="mt-3 text-center font-mono text-label text-ink-3 md:hidden">
          {home.short} vs {away.short}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <ShareBar
            title={`${home.short} vs ${away.short}`}
            path={matchPath(detail)}
            kind={detail.competition}
            stat={detail.homeScore != null && detail.awayScore != null ? `${detail.homeScore}–${detail.awayScore}` : kickoffLabel(detail.kickoffIso)}
          />
          <Link
            to={predictionPath(detail)}
            className="inline-flex items-center gap-1.5 rounded-full border border-iq/30 bg-iq-soft px-3 py-1.5 font-mono text-micro uppercase tracking-wider text-iq-ink transition-colors hover:border-iq/60"
          >
            AI prediction
          </Link>
        </div>
      </motion.div>

      {/* Momentum, stats, lineups and the event feed all describe play that
          happened. Before kickoff there is none, so those tabs are withheld
          rather than filled with a plausible-looking invention about a real
          fixture. FootIQ (preview inference) stays — it is amber-marked. */}
      {!played ? (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3.5">
          <p className="text-caption leading-relaxed text-ink-3">
            <span className="font-semibold text-ink-2">
              {detail.status === "postponed" ? "This match was postponed." : detail.status === "cancelled" ? "This match was cancelled." : "This match hasn't kicked off yet."}
            </span>{" "}
            {detail.status === "upcoming"
              ? "Momentum, stats, lineups and the event feed appear once it's under way."
              : "No stats or lineups exist for it."}
          </p>
        </div>
      ) : (
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
      )}

      {played && (
        <DemoDataNotice
          domain="match analysis"
          detail="The scoreline, kickoff, competition and venue are provider-synced facts. Momentum, xG, possession, player ratings, heatmaps and the event feed are derived sample data — no match-statistics provider is connected."
        />
      )}

      {played && tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Card className="p-4 md:p-5">
              <SectionHeader title="Momentum" className="mb-3" />
              <MomentumRiver data={detail.momentum} homeLabel={home.short} awayLabel={away.short} />
            </Card>

            <Card className="p-4 md:p-5">
              <SectionHeader title="Match Stats" className="mb-4" />
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
              <SectionHeader title="Timeline" className="mb-3" />
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
                      <p className="font-mono text-micro uppercase tracking-wider text-ink-3">
                        {e.minute}'{e.teamId ? ` · ${getTeam(e.teamId).tla}` : ""}
                        {e.player ? ` · ${e.player}` : ""}
                      </p>
                      <p className="mt-0.5 text-ui leading-snug text-ink-2">{e.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}

      {played && tab === "stats" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4 md:p-5">
            <SectionHeader title="All Stats" className="mb-4" />
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

      {played && tab === "lineups" && (
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
            <p className="mt-2 text-center font-mono text-micro uppercase tracking-wide text-ink-3">
              Hover players for ratings · {home.tla} attacks →
            </p>
          </Card>
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="FootIQ ratings" title="Top Performers" className="mb-3" />
            <ol className="space-y-2.5">
              {ratings.map((p, i) => (
                <li key={`${p.teamId}-${p.shirt}`} className="flex items-center gap-3">
                  <span className="w-4 text-center font-mono text-label text-ink-3">{i + 1}</span>
                  <span className="relative">
                    <Avatar name={p.name} playerId={p.playerId} size={30} />
                    <Crest teamId={p.teamId} size={14} className="absolute -bottom-0.5 -right-1" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {p.playerId ? (
                      <Link to={`/player/${p.playerId}`} className="truncate text-ui font-semibold text-ink hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="truncate text-ui font-semibold text-ink">{p.name}</span>
                    )}
                    <p className="text-micro uppercase tracking-wide text-ink-3">{p.pos}</p>
                  </div>
                  <span
                    className={cn(
                      "tabular rounded-lg px-2 py-0.5 font-mono text-caption font-bold",
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

      {(!played || tab === "iq") && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <IQInsight title="Tactical read" feedback="Match tactical read">{detail.tacticalNote}</IQInsight>
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow={played ? "Live model feed" : "Pre-match read"} title="AI Commentary" className="mb-3" />
              <ol className="space-y-4">
                {[...detail.aiCommentary].reverse().map((c, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-iq-soft text-iq-ink">
                      <Sparkles className="size-3.5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-micro uppercase tracking-wider text-ink-3">
                        {c.minute > 0 ? `${c.minute}' · ` : ""}{c.kind}
                      </p>
                      <p className="mt-1 text-ui leading-relaxed text-ink-2">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <div className="space-y-4">
            {/*
              Win probability renders ONLY when a prediction actually exists for
              this match. It used to pass `{ h: live ? 64 : 45, d: ..., a: ... }`
              — two hardcoded triplets shown for every fixture in the app under
              the label "Model estimate", captioned "updates every event". No
              model produced them and they never updated. Same class of
              fabrication as the confidence numbers deleted in chunk 1, so the
              same treatment: delete the literals rather than dress them up.
            */}
            {prediction ? (
              <Card className="p-4 md:p-5">
                <SectionHeader eyebrow="Model estimate" title="Win Probability" className="mb-4" />
                <WinProb home={home.short} away={away.short} detail={{ h: prediction.homeWin, d: prediction.draw, a: prediction.awayWin }} />
                <div className="mt-3 border-t border-line pt-2.5">
                  <DemoEngineChip />
                </div>
              </Card>
            ) : (
              <Card className="p-4 md:p-5">
                <SectionHeader eyebrow="Model estimate" title="Win Probability" className="mb-3" />
                <p className="text-caption leading-relaxed text-ink-3">
                  No win probability for this fixture. FootIQ has no prediction model connected, so rather than show a
                  number nothing produced, it shows nothing.
                </p>
              </Card>
            )}
            {/*
              Removed: a "What decides it" card reading "{home} lead the league
              in corner conversion while {away} rank bottom-six defending them."
              Hardcoded for every fixture, so it asserted a specific, checkable,
              false league statistic about whichever two real clubs were on
              screen. Amber marks inference — it does not license inventing a
              measured fact. Restore only from real set-piece data.
            */}
          </div>
        </div>
      )}
    </div>
  );
}

function PossessionBar({ homeName, awayName, home, away }: { homeName: string; awayName: string; home: number; away: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-label text-ink-2">
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
      {/* "Updates every event" was never true — nothing recomputes these. */}
      <p className="pt-1 font-mono text-micro uppercase tracking-wider text-ink-3">
        <ArrowLeftRight className="mr-1 inline size-3" aria-hidden />
        Probabilities, not promises
      </p>
    </div>
  );
}
