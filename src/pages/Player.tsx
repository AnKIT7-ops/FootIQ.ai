import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, BriefcaseMedical, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Flag } from "@/components/ui/Flag";
import { Crest } from "@/components/ui/Crest";
import { Tabs } from "@/components/ui/Tabs";
import { StatTile, Meter } from "@/components/ui/StatTile";
import { IQInsight, IQTag } from "@/components/ui/IQInsight";
import { DemoEngineChip } from "@/components/ui/DemoEngineChip";
import { Radar } from "@/components/charts/Radar";
import { Sparkline } from "@/components/charts/Sparkline";
import { Heatmap } from "@/components/charts/Heatmap";
import { ShotMap } from "@/components/charts/ShotMap";
import { PassMap } from "@/components/charts/PassMap";
import { getPlayer, attributeLabels } from "@/lib/repositories/players";
import type { Player } from "@/data/types";
import NotFound from "./NotFound";
import { getTeam } from "@/lib/repositories/teams";
import { heatmapFor, passMapFor, shotMapFor } from "@/data/generators";
import { money } from "@/lib/utils";
import { usePageMeta, personJsonLd } from "@/lib/seo";
import { playerPath, playerSlug, resolvePlayer, teamPath } from "@/lib/slugs";
import { contentBySlug } from "@/lib/repositories/content";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ShareBar } from "@/components/ui/ShareBar";
import { recordView } from "@/lib/recent";

export default function PlayerPage() {
  const { id } = useParams();
  // Player data is bundled (seeded synchronously), so a miss is a real 404 — never
  // fall back to another player's page.
  const player = useMemo(() => resolvePlayer(id), [id]);
  return player ? <PlayerView player={player} /> : <NotFound />;
}

function PlayerView({ player }: { player: Player }) {
  const navigate = useNavigate();
  const team = getTeam(player.teamId);
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    recordView({ kind: "player", id: player.id, label: player.name, sub: player.role, path: playerPath(player) });
  }, [player]);
  usePageMeta({
    title: `${player.name} — Stats, Heatmaps & AI Scouting`,
    description: `${player.name} (${player.role}, ${team.name}): season stats, attribute radar, pitch maps, injury and transfer history with an AI scouting verdict.`,
    path: playerPath(player),
    type: "profile",
    jsonLd: personJsonLd(player, { teamName: team.name, path: playerPath(player) }),
    breadcrumbs: [
      { name: team.name, path: teamPath(team) },
      { name: player.name, path: playerPath(player) },
    ],
  });

  const heat = useMemo(() => heatmapFor(player.id, player.position, player.role), [player.id, player.position, player.role]);
  const shots = useMemo(() => shotMapFor(player.id, player.stats.goals, player.stats.xG), [player.id, player.stats.goals, player.stats.xG]);
  const passes = useMemo(() => passMapFor(player.id, player.position), [player.id, player.position]);

  const axes = Object.keys(attributeLabels) as Array<keyof typeof attributeLabels>;

  return (
    <div className="space-y-6">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="floodlight card relative overflow-hidden p-5 md:p-7">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={player.name} playerId={player.id} size={84} ringColor={team.colors[0]} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{player.role}</p>
              <Badge variant="accent">#{player.shirt}</Badge>
              {player.starter && <Badge>Starter</Badge>}
            </div>
            <h1 className="display mt-1 text-3xl font-black text-ink md:text-4xl">{player.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-ui text-ink-2">
              <Link to={teamPath(team)} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                <Crest teamId={team.id} size={20} />
                {team.name}
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <Flag nationality={player.nationality} emoji={player.flag} /> {player.nationality}
              </span>
              <span>{player.age} yrs</span>
              <span>{player.heightCm} cm</span>
              <span>{player.foot}-footed</span>
              <span className="font-mono text-ink-3">Contract to {player.contractUntil}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="eyebrow">Season rating</p>
              <p className="display text-4xl font-black text-accent-ink">{player.stats.rating.toFixed(2)}</p>
            </div>
            <Sparkline data={player.form} width={88} height={40} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FavoriteButton kind="player" refId={player.id} name={player.name} />
          <ShareBar
            title={`${player.name} — ${player.role}`}
            path={playerPath(player)}
            kind="Player Profile"
            stat={`Rating ${player.stats.rating.toFixed(2)} · ${player.stats.goals}G ${player.stats.assists}A`}
          />
          {contentBySlug(`analysis-${playerSlug(player)}`) && (
            <Link
              to={`/intelligence/analysis-${playerSlug(player)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-iq/30 bg-iq-soft px-3 py-1.5 font-mono text-micro uppercase tracking-wider text-iq-ink transition-colors hover:border-iq/60"
            >
              <Sparkles className="size-3.5" aria-hidden /> AI analysis
            </Link>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Market value" value={player.marketValue / 1_000_000} suffix="M €" />
          <StatTile label="Weekly wage" value={player.weeklyWage / 1000} suffix="K €" />
          <StatTile label="Apps" value={player.stats.apps} />
          <StatTile label="Goals" value={player.stats.goals} delta={player.stats.goals - player.stats.xG} deltaSuffix=" vs xG" />
          <StatTile label="Assists" value={player.stats.assists} delta={player.stats.assists - player.stats.xA} deltaSuffix=" vs xA" />
          <StatTile label="Minutes" value={player.stats.minutes} />
        </div>
      </motion.div>

      <Tabs
        id="player"
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "maps", label: "Pitch Maps" },
          { value: "history", label: "History" },
          { value: "iq", label: "FootIQ Read" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="Attribute model" title="Profile Radar" className="mb-2" />
            <Radar
              axes={axes.map((a) => attributeLabels[a])}
              series={[{ label: player.name, color: "var(--chart-1)", values: axes.map((a) => player.attributes[a]) }]}
              size={320}
            />
          </Card>
          <div className="space-y-6">
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="2025/26 season" title="Production" className="mb-4" />
              <div className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                <Meter label="xG" value={player.stats.xG} max={25} color="var(--chart-1)" />
                <Meter label="xA" value={player.stats.xA} max={12} color="var(--chart-2)" />
                <Meter label="Key passes / game" value={player.stats.keyPasses} max={4} color="var(--chart-2)" />
                <Meter label="Dribbles / game" value={player.stats.dribblesPerGame} max={4} color="var(--chart-1)" />
                <Meter label="Pass accuracy %" value={player.stats.passAccuracy} color="var(--chart-2)" />
                <Meter label="Tackles / game" value={player.stats.tacklesPerGame} max={4} color="var(--chart-4)" />
                <Meter label="Interceptions / game" value={player.stats.interceptionsPerGame} max={3} color="var(--chart-4)" />
                <Meter label="Aerials won / game" value={player.stats.aerialsWonPerGame} max={4} color="var(--chart-4)" />
              </div>
            </Card>
            <Card className="p-4 md:p-5">
              <SectionHeader title="Biography" className="mb-2" />
              <p className="text-body leading-relaxed text-ink-2">{player.bio}</p>
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-body leading-relaxed text-ink-2">
                  <IQTag className="mr-2 align-[2px]">Playing style</IQTag>
                  {player.style}
                </p>
                <DemoEngineChip className="mt-2" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "maps" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4 md:p-5">
            <SectionHeader title="Touch Heatmap" className="mb-3" />
            <Heatmap cells={heat} />
          </Card>
          <Card className="p-4 md:p-5">
            <SectionHeader title="Shot Map" className="mb-3" />
            <ShotMap shots={shots} />
          </Card>
          <Card className="p-4 md:p-5 lg:col-span-2">
            <SectionHeader title="Passing Map" className="mb-3" />
            <PassMap passes={passes} />
          </Card>
        </div>
      )}

      {tab === "history" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4 md:p-5">
            <SectionHeader title="Injury History" className="mb-3" />
            {player.injuryHistory.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <CheckCircle2 className="size-4 text-accent-ink" aria-hidden />
                No recorded injuries — elite availability.
              </p>
            ) : (
              <ul className="space-y-3">
                {player.injuryHistory.map((inj, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bad/10 text-bad">
                      <BriefcaseMedical className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-ui font-semibold text-ink">{inj.injury}</p>
                      <p className="font-mono text-label text-ink-3">
                        {inj.date} · {inj.daysOut} days · {inj.gamesMissed} games missed
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-4 md:p-5">
            <SectionHeader title="Transfer History" className="mb-3" />
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[0.34rem] before:top-2 before:w-px before:bg-line">
              {[...player.transferHistory].reverse().map((tr, i) => (
                <li key={i} className="relative flex gap-3">
                  <span className="z-10 mt-1.5 size-3 shrink-0 rounded-full border-2 border-chart-2 bg-bg" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-semibold text-ink">
                      {tr.from} <ArrowRight className="inline size-3.5 text-ink-3" aria-hidden /> {tr.to}
                    </p>
                    <p className="font-mono text-label text-ink-3">
                      {tr.season} ·{" "}
                      {typeof tr.fee === "number" ? money(tr.fee) : tr.fee === "academy" ? "Academy graduate" : tr.fee === "free" ? "Free transfer" : "Loan"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {tab === "iq" && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4 md:p-5">
                <p className="eyebrow mb-3 text-accent-ink">Strengths</p>
                <ul className="space-y-2.5">
                  {player.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-ui leading-snug text-ink-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-4 md:p-5">
                <p className="eyebrow mb-3 text-bad">Weaknesses</p>
                <ul className="space-y-2.5">
                  {player.weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-2.5 text-ui leading-snug text-ink-2">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <IQInsight title="Scout's verdict" feedback="Player scout verdict">{player.style}</IQInsight>
          </div>
          <Card className="p-4 md:p-5">
            <SectionHeader
              title="Plays Like"
              className="mb-3"
              action={
                <Link to={`/similar/${player.id}`} className="font-mono text-label uppercase tracking-wider text-accent-ink hover:underline">
                  Full analysis →
                </Link>
              }
            />
            <div className="space-y-2.5">
              {player.similar.map((sid) => {
                const sp = getPlayer(sid);
                return (
                  <button
                    key={sid}
                    onClick={() => navigate(`/player/${sid}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong"
                  >
                    <Avatar name={sp.name} playerId={sp.id} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ui font-semibold text-ink">{sp.name}</p>
                      <p className="text-label text-ink-3">
                        {sp.role} · {getTeam(sp.teamId).short}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-ink-3" aria-hidden />
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
