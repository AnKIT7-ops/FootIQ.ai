import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, BriefcaseMedical } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge, FormPills } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { StatTile, Meter } from "@/components/ui/StatTile";
import { IQInsight } from "@/components/ui/IQInsight";
import { MatchCard } from "@/components/ui/MatchCard";
import { DonutGauge } from "@/components/charts/DonutGauge";
import { teams, getTeam } from "@/lib/repositories/teams";
import { playersOf } from "@/lib/repositories/players";
import { depthSquad } from "@/data/generators";
import { teamMatches } from "@/lib/repositories/matches";
import { transferRumors } from "@/lib/repositories/transfers";
import { getPlayer } from "@/lib/repositories/players";
import { cn, money } from "@/lib/utils";
import { sportsTeamJsonLd, usePageMeta } from "@/lib/seo";
import { managerPath, resolveTeam, teamPath } from "@/lib/slugs";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ShareBar } from "@/components/ui/ShareBar";

export default function TeamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const team = useMemo(() => {
    try {
      return resolveTeam(id) ?? getTeam(id ?? "ars");
    } catch {
      return teams[0];
    }
  }, [id]);
  const [tab, setTab] = useState("squad");
  usePageMeta({
    title: `${team.name} — Squad, Tactics & AI Analysis`,
    description: `${team.name}: squad depth, fixtures and results, tactical style DNA, transfer threads and the AI tactical report.`,
    path: teamPath(team),
    jsonLd: sportsTeamJsonLd(team, teamPath(team)),
    breadcrumbs: [{ name: team.name, path: teamPath(team) }],
  });
  const stars = playersOf(team.id);
  const depth = useMemo(() => depthSquad(team.id), [team.id]);
  const { fixtures, results } = teamMatches(team.id);
  const rumors = transferRumors.filter((r) => r.fromId === team.id || r.toId === team.id);
  const injuries = stars.flatMap((p) =>
    p.injuryHistory.filter((i) => i.date.includes("2026") || i.date.includes("Feb 2026") || i.date.includes("Dec 2025")).map((i) => ({ p, i })),
  );

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
              <span className="text-[13px] text-ink-2">
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
          { value: "market", label: "Transfers & Injuries" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "squad" && (
        <div className="space-y-6">
          <section aria-label="Key players">
            <SectionHeader eyebrow="The core" title="Key Players" className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stars.map((p) => (
                <Card hover key={p.id} onClick={() => navigate(`/player/${p.id}`)} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} playerId={p.id} size={44} ringColor={team.colors[0]} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-ink">{p.name}</p>
                      <p className="text-[11.5px] text-ink-3">{p.role} · #{p.shirt}</p>
                    </div>
                    <span className={cn("tabular rounded-lg px-2 py-1 font-mono text-[12.5px] font-bold", p.stats.rating >= 7.5 ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-ink-2")}>
                      {p.stats.rating.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-line pt-2.5 font-mono text-[11px] text-ink-3">
                    <span>{p.stats.goals}G {p.stats.assists}A</span>
                    <span>{money(p.marketValue)}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section aria-label="Full squad">
            <SectionHeader eyebrow="Depth chart" title="Squad List" className="mb-3" />
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-ink-3">
                    <th scope="col" className="py-2.5 pl-4 font-medium">#</th>
                    <th scope="col" className="font-medium">Player</th>
                    <th scope="col" className="font-medium">Role</th>
                    <th scope="col" className="text-right font-medium">Age</th>
                    <th scope="col" className="text-right font-medium">Apps</th>
                    <th scope="col" className="text-right font-medium">G+A</th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stars.map((p) => ({ kind: "star" as const, p })), ...depth.map((p) => ({ kind: "depth" as const, p }))].map((row) => (
                    <tr
                      key={row.p.id}
                      onClick={row.kind === "star" ? () => navigate(`/player/${row.p.id}`) : undefined}
                      tabIndex={row.kind === "star" ? 0 : undefined}
                      onKeyDown={
                        row.kind === "star"
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(`/player/${row.p.id}`);
                              }
                            }
                          : undefined
                      }
                      aria-label={row.kind === "star" ? `${row.p.name} player page` : undefined}
                      className={cn("border-b border-line last:border-0", row.kind === "star" && "cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2")}
                    >
                      <td className="py-2.5 pl-4 font-mono text-xs text-ink-3">{row.p.shirt}</td>
                      <td>
                        <span className="flex items-center gap-2 font-medium text-ink">
                          {row.p.name}
                          {row.kind === "star" && <Badge variant="accent" className="hidden sm:inline-flex">Key</Badge>}
                        </span>
                      </td>
                      <td className="text-ink-2">{row.p.role}</td>
                      <td className="tabular text-right font-mono text-xs text-ink-2">{row.p.age}</td>
                      <td className="tabular text-right font-mono text-xs text-ink-2">{"stats" in row.p ? row.p.stats.apps : row.p.apps}</td>
                      <td className="tabular text-right font-mono text-xs text-ink-2">
                        {"stats" in row.p ? row.p.stats.goals + row.p.stats.assists : row.p.goals + row.p.assists}
                      </td>
                      <td className="tabular py-2.5 pr-4 text-right font-mono text-xs text-ink-2">{money(row.p.marketValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </div>
      )}

      {tab === "matches" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Fixtures">
            <SectionHeader eyebrow="Upcoming" title="Fixtures" className="mb-3" />
            <div className="space-y-2.5">
              {fixtures.map((m) => (
                <MatchCard key={m.id} match={m} dense />
              ))}
              {fixtures.length === 0 && <p className="text-sm text-ink-3">No scheduled fixtures in the demo window.</p>}
            </div>
          </section>
          <section aria-label="Results">
            <SectionHeader eyebrow="Recent" title="Results" className="mb-3" />
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
              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
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
              <p className="mt-3 text-center text-[12.5px] leading-relaxed text-ink-3">
                Minutes shared, pass-network density and lineup stability, rolled into one number.
              </p>
            </Card>
            <Card className="p-4">
              <p className="eyebrow mb-3">Season shape</p>
              <div className="flex items-center gap-3 text-[13px] text-ink-2">
                <Activity className="size-4 text-accent-ink" aria-hidden />
                {team.won}W · {team.drawn}D · {team.lost}L — {team.gf} scored, {team.ga} conceded
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "market" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Transfer involvement">
            <SectionHeader eyebrow="Rumor mill" title="Transfer Threads" className="mb-3" />
            <div className="space-y-2.5">
              {rumors.map((r) => {
                const p = getPlayer(r.playerId);
                const incoming = r.toId === team.id;
                return (
                  <Card hover key={r.id} onClick={() => navigate("/transfers")} className="flex items-center gap-3 p-3.5">
                    <Avatar name={p.name} playerId={p.id} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{p.name}</p>
                      <p className="text-[11px] text-ink-3">
                        {incoming ? `In from ${getTeam(r.fromId).short}` : `Out to ${getTeam(r.toId).short}`} · {money(r.fee)}
                      </p>
                    </div>
                    <Badge variant={incoming ? "accent" : "warn"}>{r.probability}%</Badge>
                  </Card>
                );
              })}
              {rumors.length === 0 && <p className="text-sm text-ink-3">No active threads for this club.</p>}
            </div>
          </section>
          <section aria-label="Injury list">
            <SectionHeader eyebrow="Treatment room" title="Injuries & Doubts" className="mb-3" />
            <div className="space-y-2.5">
              {injuries.map(({ p, i }, idx) => (
                <Card key={idx} className="flex items-center gap-3 p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bad/10 text-bad">
                    <BriefcaseMedical className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/player/${p.id}`} className="truncate text-[13.5px] font-semibold text-ink hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-ink-3">{i.injury} · {i.date}</p>
                  </div>
                  <span className="font-mono text-[11px] text-ink-3">{i.gamesMissed} gms</span>
                </Card>
              ))}
              {injuries.length === 0 && (
                <Card className="p-4 text-sm text-ink-2">Fully fit squad — no current absences flagged by the model.</Card>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
