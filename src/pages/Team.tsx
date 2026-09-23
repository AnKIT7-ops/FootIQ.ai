import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, BriefcaseMedical, Loader2 } from "lucide-react";
import type { SquadMember, Team } from "@/data/types";
import type { RepoStatus } from "@/lib/repositories/store";
import { api } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";
import NotFound from "./NotFound";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge, FormPills } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { StatTile, Meter } from "@/components/ui/StatTile";
import { IQInsight } from "@/components/ui/IQInsight";
import { MatchCard } from "@/components/ui/MatchCard";
import { DonutGauge } from "@/components/charts/DonutGauge";
import { useTeamsState } from "@/lib/repositories/teams";
import { usePlayers } from "@/lib/repositories/players";
import { teamMatches } from "@/lib/repositories/matches";
import { cn } from "@/lib/utils";
import { playerPathFor } from "@/lib/slug-builders";
import { sportsTeamJsonLd, usePageMeta } from "@/lib/seo";
import { managerPath, resolveTeam, teamPath } from "@/lib/slugs";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ShareBar } from "@/components/ui/ShareBar";
import { recordView } from "@/lib/recent";

export default function TeamPage() {
  const { id } = useParams();
  // Synced clubs (e.g. fd-341) only exist after hydration, so re-resolve on every
  // data swap — resolving once on [id] could lock onto the wrong club or a 404.
  const { data: allTeams, status } = useTeamsState();
  const team = useMemo(() => resolveTeam(id), [id, allTeams]);
  if (team) return <TeamView team={team} />;
  if (status === "loading") {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-caption text-ink-3" role="status">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Loading club…
      </div>
    );
  }
  return <NotFound />;
}

/** Real squad from /api/teams/:id — list endpoints strip it to stay small. */
function useSquad(teamId: string): { status: RepoStatus; data: SquadMember[] } {
  const [state, setState] = useState<{ status: RepoStatus; data: SquadMember[] }>({
    status: backendConfigured ? "loading" : "unavailable",
    data: [],
  });
  useEffect(() => {
    if (!backendConfigured) return;
    let live = true;
    setState({ status: "loading", data: [] });
    api
      .get<Team>(`/api/teams/${encodeURIComponent(teamId)}`)
      .then((t) => live && setState({ status: "ready", data: t.squad ?? [] }))
      .catch(() => live && setState({ status: "error", data: [] }));
    return () => {
      live = false;
    };
  }, [teamId]);
  return state;
}

/** football-data's coarse buckets → fan vocabulary; finer roles ("Right Winger") pass through. */
const POSITION_LABEL: Record<string, string> = { Offence: "Forward", Defence: "Defender", Midfield: "Midfielder" };

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  const hadBirthday = now.getMonth() > b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() >= b.getDate());
  return now.getFullYear() - b.getFullYear() - (hadBirthday ? 0 : 1);
}

function TeamView({ team }: { team: Team }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("squad");
  useEffect(() => {
    recordView({ kind: "team", id: team.id, label: team.name, sub: team.league, path: teamPath(team) });
  }, [team]);
  usePageMeta({
    title: `${team.name} — Squad, Tactics & AI Analysis`,
    description: `${team.name}: squad and minutes, fixtures and results, availability, tactical style DNA and the AI tactical report.`,
    path: teamPath(team),
    jsonLd: sportsTeamJsonLd(team, teamPath(team)),
    breadcrumbs: [{ name: team.name, path: teamPath(team) }],
  });
  // Real Premier League players (FPL); empty for clubs outside the Premier League.
  const allPlayers = usePlayers();
  const stars = useMemo(() => allPlayers.filter((p) => p.teamId === team.id).sort((a, b) => b.stats.minutes - a.stats.minutes), [allPlayers, team.id]);
  const squad = useSquad(team.id);
  const { fixtures, results } = teamMatches(team.id);
  const unavailable = stars.filter((p) => p.availability !== "available");

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative overflow-hidden p-5 md:p-7"
        style={{
          background: `radial-gradient(900px 380px at 12% -20%, ${team.colors[0]}2e, transparent 60%), var(--surface)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-5">
          <Crest teamId={team.id} size={76} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{team.league} · {team.stadium}</p>
            <h1 className="display mt-0.5 text-3xl font-black text-ink md:text-4xl">{team.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <FormPills form={team.form} />
              <span className="text-ui text-ink-2">
                Manager:{" "}
                <Link to={managerPath(team)} className="font-semibold text-ink hover:underline">
                  {team.manager}
                </Link>
              </span>
              {team.styleTags.map((t) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Position" value={team.position} className="min-w-[5.5rem]" />
            <StatTile label="Points" value={team.points} className="min-w-[5.5rem]" />
            <StatTile label="Goal diff" value={team.gf - team.ga} className="min-w-[5.5rem]" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FavoriteButton kind="team" refId={team.id} name={team.name} />
          <ShareBar
            title={team.name}
            path={teamPath(team)}
            kind="Team Analysis"
            stat={`${team.position}ᵗʰ · ${team.points} pts · ${team.form}`}
          />
        </div>
      </motion.div>

      <Tabs
        id="team"
        tabs={[
          { value: "squad", label: "Squad" },
          { value: "matches", label: "Matches" },
          { value: "tactics", label: "Tactics & IQ" },
          { value: "market", label: "Availability" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "squad" && (
        <div className="space-y-6">
          {stars.length > 0 && (
            <section aria-label="Most-used players">
              <SectionHeader eyebrow="Premier League minutes · FPL" title="Most-Used Players" className="mb-3" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stars.slice(0, 6).map((p) => (
                  <Card hover key={p.id} onClick={() => navigate(playerPathFor(p))} className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} photoUrl={p.photoUrl} size={44} ringColor={team.colors[0]} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-bold text-ink">{p.name}</p>
                        <p className="text-label text-ink-3">
                          {p.role}
                          {p.age != null ? ` · ${p.age}y` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-line pt-2.5 font-mono text-label text-ink-3">
                      <span>
                        {p.stats.goals}G {p.stats.assists}A
                      </span>
                      <span>{p.stats.minutes} min</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Full squad">
            <SectionHeader eyebrow="Registered squad · football-data.org" title="Squad List" className="mb-3" />
            {squad.status !== "ready" || squad.data.length === 0 ? (
              <Card className="p-5">
                <p className="flex items-center gap-2 text-caption text-ink-3" role="status">
                  {squad.status === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading squad…
                    </>
                  ) : (
                    "Squad list unavailable right now. It appears once club data syncs — we show nothing rather than invent names."
                  )}
                </p>
              </Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-ui">
                  <thead>
                    <tr className="border-b border-line text-left font-mono text-micro uppercase tracking-wider text-ink-3">
                      <th scope="col" className="py-2.5 pl-4 font-medium">Player</th>
                      <th scope="col" className="font-medium">Position</th>
                      <th scope="col" className="text-right font-medium">Age</th>
                      <th scope="col" className="py-2.5 pr-4 text-right font-medium">Nationality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {squad.data.map((m) => {
                      // Link through only when we hold a profile for this exact player.
                      const star = stars.find((p) => p.name === m.name);
                      const open = star ? () => navigate(playerPathFor(star)) : undefined;
                      return (
                        <tr
                          key={`${m.name}-${m.dateOfBirth ?? ""}`}
                          onClick={open}
                          tabIndex={star ? 0 : undefined}
                          onKeyDown={
                            open
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    open();
                                  }
                                }
                              : undefined
                          }
                          aria-label={star ? `${m.name} player page` : undefined}
                          className={cn("border-b border-line last:border-0", star && "cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2")}
                        >
                          <td className="py-2.5 pl-4">
                            <span className="flex items-center gap-2 font-medium text-ink">
                              {m.name}
                            </span>
                          </td>
                          <td className="text-ink-2">{m.position ? (POSITION_LABEL[m.position] ?? m.position) : "—"}</td>
                          <td className="tabular text-right font-mono text-xs text-ink-2">{ageFrom(m.dateOfBirth) ?? "—"}</td>
                          <td className="py-2.5 pr-4 text-right text-ink-2">{m.nationality ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </div>
      )}

      {tab === "matches" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Fixtures">
            <SectionHeader title="Fixtures" className="mb-3" />
            <div className="space-y-2.5">
              {fixtures.map((m) => (
                <MatchCard key={m.id} match={m} dense />
              ))}
              {fixtures.length === 0 && <p className="text-sm text-ink-3">No scheduled fixtures in the demo window.</p>}
            </div>
          </section>
          <section aria-label="Results">
            <SectionHeader title="Results" className="mb-3" />
            <div className="space-y-2.5">
              {results.map((m) => (
                <MatchCard key={m.id} match={m} dense />
              ))}
              {results.length === 0 && <p className="text-sm text-ink-3">No recent results in the demo window.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === "tactics" && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <IQInsight title="AI tactical report" feedback="Team tactical report">
              <ul className="space-y-2">
                {team.aiReport.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-iq" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            </IQInsight>
            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow={`${team.style.formation}`} title="Style DNA" className="mb-4" />
              <div className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                <Meter label="Tempo" value={team.style.tempo} color="var(--chart-1)" />
                <Meter label="Width" value={team.style.width} color="var(--chart-2)" />
                <Meter label="Directness" value={team.style.directness} color="var(--chart-3)" />
                <Meter label="Press intensity" value={team.style.pressIntensity} color="var(--chart-4)" />
              </div>
              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-ui">
                <div className="flex justify-between gap-6"><dt className="shrink-0 text-ink-3">Build-up</dt><dd className="text-right text-ink-2">{team.style.buildUp}</dd></div>
                <div className="flex justify-between gap-6"><dt className="shrink-0 text-ink-3">Press</dt><dd className="text-right text-ink-2">{team.style.press}</dd></div>
                <div className="flex justify-between gap-6"><dt className="shrink-0 text-ink-3">Line</dt><dd className="text-right text-ink-2">{team.style.line}</dd></div>
              </dl>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="flex flex-col items-center p-5">
              <p className="eyebrow mb-3 self-start">Squad chemistry</p>
              <DonutGauge value={team.chemistry} label="Cohesion index" size={150} color={team.chemistry >= 85 ? "var(--chart-1)" : "var(--chart-3)"} />
              <p className="mt-3 text-center text-caption leading-relaxed text-ink-3">
                Minutes shared, pass-network density and lineup stability, rolled into one number.
              </p>
            </Card>
            <Card className="p-4">
              <p className="eyebrow mb-3">Season shape</p>
              <div className="flex items-center gap-3 text-ui text-ink-2">
                <Activity className="size-4 text-accent-ink" aria-hidden />
                {team.won}W · {team.drawn}D · {team.lost}L — {team.gf} scored, {team.ga} conceded
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "market" && (
        <section aria-label="Injuries and doubts" className="max-w-2xl">
          <SectionHeader eyebrow="Official FPL flags" title="Injuries & Doubts" className="mb-3" />
          <div className="space-y-2.5">
            {unavailable.map((p) => (
              <Card key={p.id} className="flex items-center gap-3 p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bad/10 text-bad">
                  <BriefcaseMedical className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={playerPathFor(p)} className="truncate text-ui font-semibold text-ink hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-label text-ink-3">{p.news || p.availability}</p>
                </div>
                {p.chanceOfPlaying != null && <span className="font-mono text-label text-ink-3">{p.chanceOfPlaying}%</span>}
              </Card>
            ))}
            {unavailable.length === 0 && (
              <Card className="p-4 text-sm text-ink-2">
                {stars.length > 0
                  ? "No injuries, doubts or suspensions flagged by the Premier League."
                  : "Availability comes from the Premier League's FPL feed, so it's only shown for Premier League clubs."}
              </Card>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
