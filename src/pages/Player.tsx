import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BriefcaseMedical } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { Tabs } from "@/components/ui/Tabs";
import { StatTile, Meter } from "@/components/ui/StatTile";
import { IQTag } from "@/components/ui/IQInsight";
import { AiAnswer } from "@/components/ui/AiAnswer";
import { DataState } from "@/components/ui/DataState";
import { Radar } from "@/components/charts/Radar";
import { usePlayersState } from "@/lib/repositories/players";
import type { Player } from "@/data/types";
import NotFound from "./NotFound";
import { getTeam } from "@/lib/repositories/teams";
import { usePageMeta, personJsonLd } from "@/lib/seo";
import { playerPath, resolvePlayer, teamPath } from "@/lib/slugs";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ShareBar } from "@/components/ui/ShareBar";
import { recordView } from "@/lib/recent";
import { MIN_MINUTES, hasSample, profile } from "@/lib/player-stats";

export default function PlayerPage() {
  const { id } = useParams();
  // Players arrive from the API, so re-resolve on every data swap; only a miss
  // AFTER the list loaded is a real 404.
  const { data: all, status } = usePlayersState();
  const player = useMemo(() => resolvePlayer(id), [id, all]);
  if (player) return <PlayerView player={player} all={all} />;
  if (status === "ready" && all.length > 0) return <NotFound />;
  return (
    <div className="py-16">
      <DataState status={status} empty={all.length === 0} loadingLabel="Loading player…" emptyTitle="Players haven't synced yet" emptyBody="Player data comes from the Premier League's FPL feed and syncs hourly. Try again shortly." />
    </div>
  );
}

const AVAILABILITY_LABEL: Record<Player["availability"], string> = {
  available: "Available",
  doubtful: "Doubtful",
  injured: "Injured",
  suspended: "Suspended",
  ineligible: "Not eligible",
};

function PlayerView({ player, all }: { player: Player; all: Player[] }) {
  const team = getTeam(player.teamId);
  const [tab, setTab] = useState("overview");
  const s = player.stats;
  useEffect(() => {
    recordView({ kind: "player", id: player.id, label: player.name, sub: player.role, path: playerPath(player) });
  }, [player]);
  usePageMeta({
    title: `${player.name} — Premier League Stats`,
    description: `${player.name} (${player.role}, ${team.name}): ${s.goals} goals, ${s.assists} assists and ${s.minutes} minutes this Premier League season, with per-90 percentiles against every ${player.role.toLowerCase()}.`,
    path: playerPath(player),
    type: "profile",
    jsonLd: personJsonLd(player, { teamName: team.name, path: playerPath(player) }),
    breadcrumbs: [
      { name: team.name, path: teamPath(team) },
      { name: player.name, path: playerPath(player) },
    ],
  });

  const axes = useMemo(() => profile(all, player), [all, player]);
  const isKeeper = player.position === "GK";

  return (
    <div className="space-y-6">
      <div className="floodlight card relative overflow-hidden p-5 md:p-7">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={player.name} photoUrl={player.photoUrl} size={84} ringColor={team.colors[0]} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{player.role}</p>
              {player.availability !== "available" && (
                <Badge variant="bad">
                  {AVAILABILITY_LABEL[player.availability]}
                  {player.chanceOfPlaying != null && player.chanceOfPlaying > 0 ? ` · ${player.chanceOfPlaying}%` : ""}
                </Badge>
              )}
            </div>
            <h1 className="display mt-1 text-3xl font-black text-ink md:text-4xl">{player.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-ui text-ink-2">
              <Link to={teamPath(team)} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                <Crest teamId={team.id} size={20} />
                {team.name}
              </Link>
              {player.age != null && <span>{player.age} yrs</span>}
            </div>
            {player.news && (
              <p className="mt-3 flex items-start gap-2 text-caption text-ink-2">
                <BriefcaseMedical className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
                {player.news}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FavoriteButton kind="player" refId={player.id} name={player.name} />
          <ShareBar
            title={`${player.name} — ${player.role}`}
            path={playerPath(player)}
            kind="Player Profile"
            stat={`${s.goals}G ${s.assists}A · ${s.minutes} min`}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Minutes" value={s.minutes} />
          <StatTile label="Starts" value={s.starts} />
          <StatTile label="Goals" value={s.goals} delta={s.goals - s.xG} deltaSuffix=" vs xG" />
          <StatTile label="Assists" value={s.assists} delta={s.assists - s.xA} deltaSuffix=" vs xA" />
          {isKeeper ? <StatTile label="Saves" value={s.saves} /> : <StatTile label="Tackles" value={s.tackles} />}
          <StatTile label="Clean sheets" value={s.cleanSheets} />
        </div>
        <p className="mt-3 font-mono text-micro uppercase tracking-wider text-ink-3">Premier League season to date · source: official FPL data</p>
      </div>

      <Tabs
        id="player"
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "fantasy", label: "FPL" },
          { value: "iq", label: "AI Read" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow={`Percentile vs ${player.role.toLowerCase()}s`} title="Per-90 Profile" className="mb-2" />
            {hasSample(player) ? (
              <Radar axes={axes.map((a) => a.label)} series={[{ label: player.name, color: "var(--chart-1)", values: axes.map((a) => a.pct) }]} size={320} />
            ) : (
              <p className="py-10 text-center text-caption text-ink-3">
                Fewer than {MIN_MINUTES} minutes this season — too small a sample to rank against other {player.role.toLowerCase()}s.
              </p>
            )}
          </Card>
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="Per 90 minutes" title="Output" className="mb-4" />
            <div className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {axes.map((a) => (
                <div key={a.key}>
                  <Meter label={`${a.label} · ${a.per90.toFixed(2)}`} value={a.pct} color="var(--chart-1)" />
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-caption leading-relaxed text-ink-3">
              Bars show the percentile among {player.role.toLowerCase()}s with {MIN_MINUTES}+ minutes (100 = best in the league).
              Season totals: {s.xG.toFixed(1)} xG, {s.xA.toFixed(1)} xA, {s.recoveries} recoveries, {s.cbi} clearances/blocks/interceptions,{" "}
              {s.yellowCards} yellow{s.yellowCards === 1 ? "" : "s"}
              {s.redCards > 0 ? `, ${s.redCards} red` : ""}.
            </p>
          </Card>
        </div>
      )}

      {tab === "fantasy" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Price · £m" value={player.fantasy.price} decimals={1} />
            <StatTile label="Total points" value={player.fantasy.totalPoints} />
            <StatTile label="Form" value={player.fantasy.form} decimals={1} />
            <StatTile label="Selected by" value={player.fantasy.selectedBy} decimals={1} suffix="%" />
            <StatTile label="In this GW" value={player.fantasy.transfersIn} />
            <StatTile label="Out this GW" value={player.fantasy.transfersOut} />
          </div>
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <IQTag>FPL projection</IQTag>
            <p className="text-ui text-ink-2">
              FPL's own model expects <strong className="text-ink">{player.fantasy.expectedPoints.toFixed(1)} points</strong> next gameweek. That's
              the Premier League's projection, not a FootIQ one.
            </p>
          </Card>
        </div>
      )}

      {tab === "iq" && (
        <AiAnswer
          endpoint={`/api/ai/scout/${encodeURIComponent(player.id)}/report`}
          title="AI scout read"
          cta="Write a scout read"
          feedback="Player scout report"
        />
      )}
    </div>
  );
}
