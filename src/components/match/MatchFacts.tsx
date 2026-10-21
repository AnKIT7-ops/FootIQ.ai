/**
 * The match page for real fixtures, built only from data FootIQ syncs for free:
 * results (form, head-to-head), the league table, and FPL season stats.
 * Goal timelines, lineups and match stats need an events feed we don't have,
 * so those are named as missing rather than approximated.
 */
import { Link } from "react-router-dom";
import { Activity, CalendarDays, MapPin, Trophy } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { FormPills } from "@/components/ui/Badge";
import { CompareBars } from "@/components/charts/CompareBars";
import { getTeam } from "@/lib/repositories/teams";
import { usePlayers } from "@/lib/repositories/players";
import { matchPath } from "@/lib/slugs";
import { kickoffDayHeading, kickoffTime } from "@/lib/kickoff";
import { headToHead, keyPlayers, leagueTableFor, recentForm, sameTable, seasonComparison, type FormEntry } from "@/lib/match-facts";
import { cn } from "@/lib/utils";
import type { Match, MatchDetail, Team } from "@/data/types";

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const statusText = (m: Match) =>
  ({
    live: "Live",
    finished: "Full-time",
    upcoming: "Not started",
    postponed: "Postponed",
    cancelled: "Cancelled",
    unconfirmed: "Result not confirmed",
  })[m.status];

/** Source line for measured facts — every section says where its numbers came from. */
function Source({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 border-t border-line pt-2.5 font-mono text-micro uppercase tracking-wider text-ink-3">{children}</p>;
}

export function MatchInfoCard({ detail }: { detail: MatchDetail }) {
  const rows = [
    { icon: Trophy, label: "Competition", value: detail.competition },
    { icon: CalendarDays, label: "Kickoff", value: `${kickoffDayHeading(detail.kickoffIso)} · ${kickoffTime(detail.kickoffIso)}` },
    { icon: MapPin, label: "Venue", value: detail.venue || "Not listed" },
    { icon: Activity, label: "Status", value: statusText(detail) },
  ];
  return (
    <Card className="p-4 md:p-5">
      <SectionHeader title="Match info" className="mb-3" />
      <dl className="space-y-2.5">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <dt className="w-24 shrink-0 text-caption text-ink-3">{label}</dt>
            <dd className="min-w-0 text-ui text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <Source>Fixture & score · football-data.org</Source>
    </Card>
  );
}

function FormColumn({ team, form }: { team: Team; form: FormEntry[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2">
        <Crest teamId={team.id} size={20} />
        <p className="truncate text-ui font-semibold text-ink">{team.short}</p>
        {form.length > 0 && <FormPills form={form.map((f) => f.result).reverse().join("")} className="ml-auto" />}
      </div>
      {form.length === 0 ? (
        <p className="text-caption text-ink-3">No earlier results in our synced data.</p>
      ) : (
        <ul className="space-y-1.5">
          {form.map((f) => {
            const opp = getTeam(f.opponentId);
            return (
              <li key={f.match.id}>
                <Link
                  to={matchPath(f.match)}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-caption hover:bg-surface-2"
                >
                  <span className="w-12 shrink-0 font-mono text-micro text-ink-3">{shortDate(f.match.kickoffIso)}</span>
                  <span className="w-4 shrink-0 font-mono text-micro text-ink-3" title={f.atHome ? "Home" : "Away"}>
                    {f.atHome ? "H" : "A"}
                  </span>
                  <Crest teamId={opp.id} size={16} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{opp.short}</span>
                  <span className="tabular font-mono text-ink">
                    {f.goalsFor}–{f.goalsAgainst}
                  </span>
                  <FormPills form={f.result} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Left column of the Facts tab: form, season comparison, key players, and what's missing. */
export function FactsMain({ detail, matches, teams }: { detail: MatchDetail; matches: Match[]; teams: Team[] }) {
  const home = getTeam(detail.homeId);
  const away = getTeam(detail.awayId);
  const players = usePlayers();
  const homeForm = recentForm(home.id, matches, detail.kickoffIso);
  const awayForm = recentForm(away.id, matches, detail.kickoffIso);
  // Per-game rates from two different tables (a Premier League row vs a Champions
  // League row) aren't comparable, so the comparison needs both clubs in one table.
  const season = sameTable(detail.competition, home.id, away.id, teams) ? seasonComparison(home, away) : [];
  const homeKeys = keyPlayers(home.id, players);
  const awayKeys = keyPlayers(away.id, players);
  const anyKeys = homeKeys.length > 0 || awayKeys.length > 0;

  return (
    <div className="space-y-6">
      <Card className="p-4 md:p-5">
        <SectionHeader eyebrow="Recent results before this match" title="Form" className="mb-4" />
        <div className="grid gap-6 sm:grid-cols-2">
          <FormColumn team={home} form={homeForm} />
          <FormColumn team={away} form={awayForm} />
        </div>
        <Source>Results · football-data.org</Source>
      </Card>

      {season.length > 0 && (
        <Card className="p-4 md:p-5">
          <SectionHeader eyebrow={`${detail.competition} · current table`} title="Season so far" className="mb-3" />
          <div className="mb-3 flex items-center justify-between text-caption font-semibold text-ink">
            <span className="flex items-center gap-1.5">
              <Crest teamId={home.id} size={16} /> {home.short}
            </span>
            <span className="flex items-center gap-1.5">
              {away.short} <Crest teamId={away.id} size={16} />
            </span>
          </div>
          <CompareBars rows={season.map((r) => ({ label: r.label, a: r.home, b: r.away, format: r.format }))} />
          <Source>League table · football-data.org</Source>
        </Card>
      )}

      {anyKeys && (
        <Card className="p-4 md:p-5">
          <SectionHeader eyebrow="Goals + assists this season" title="Key players" className="mb-4" />
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { team: home, list: homeKeys },
              { team: away, list: awayKeys },
            ].map(({ team, list }) => (
              <div key={team.id} className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <Crest teamId={team.id} size={20} />
                  <p className="truncate text-ui font-semibold text-ink">{team.short}</p>
                </div>
                {list.length === 0 ? (
                  <p className="text-caption text-ink-3">No Fantasy Premier League data for this club.</p>
                ) : (
                  <ol className="space-y-2">
                    {list.map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5">
                        <Avatar name={p.name} photoUrl={p.photoUrl} size={30} />
                        <div className="min-w-0 flex-1">
                          <Link to={`/player/${p.id}`} className="block truncate text-ui font-semibold text-ink hover:underline">
                            {p.name}
                          </Link>
                          <p className="text-micro uppercase tracking-wide text-ink-3">{p.role}</p>
                        </div>
                        <dl className="tabular flex gap-3 font-mono text-caption">
                          <div className="text-center">
                            <dt className="text-micro text-ink-3">G</dt>
                            <dd className="text-ink">{p.stats.goals}</dd>
                          </div>
                          <div className="text-center">
                            <dt className="text-micro text-ink-3">A</dt>
                            <dd className="text-ink">{p.stats.assists}</dd>
                          </div>
                          <div className="text-center">
                            <dt className="text-micro text-ink-3">Min</dt>
                            <dd className="text-ink-2">{p.stats.minutes}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
          <Source>Season stats · Fantasy Premier League (Premier League clubs only)</Source>
        </Card>
      )}

      <div className="rounded-xl border border-dashed border-line px-4 py-3.5">
        <p className="text-caption leading-relaxed text-ink-3">
          <span className="font-semibold text-ink-2">Goal timeline, lineups and match stats aren&apos;t available yet.</span>{" "}
          They need a live match-events data feed, which FootIQ hasn&apos;t connected. We show nothing rather than an estimate.
        </p>
      </div>
    </div>
  );
}

export function TableTab({ detail, teams }: { detail: MatchDetail; teams: Team[] }) {
  const table = leagueTableFor(detail.competition, teams);
  if (!sameTable(detail.competition, detail.homeId, detail.awayId, teams)) {
    return (
      <Card className="p-5 md:p-6">
        <SectionHeader title={`No table for ${detail.competition}`} className="mb-2" />
        <p className="max-w-prose text-caption leading-relaxed text-ink-3">
          FootIQ only holds complete domestic league tables. Cup and European competitions aren&apos;t in our table data in full,
          so we don&apos;t show a partial one.
        </p>
      </Card>
    );
  }
  const highlight = new Set([detail.homeId, detail.awayId]);
  return (
    <Card className="p-2 md:p-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-caption">
          <caption className="sr-only">{detail.competition} table</caption>
          <thead>
            <tr className="font-mono text-micro uppercase tracking-wider text-ink-3">
              <th scope="col" className="px-2 py-2 text-right">#</th>
              <th scope="col" className="px-2 py-2">Team</th>
              <th scope="col" className="px-2 py-2 text-right">P</th>
              <th scope="col" className="px-2 py-2 text-right">W</th>
              <th scope="col" className="px-2 py-2 text-right">D</th>
              <th scope="col" className="px-2 py-2 text-right">L</th>
              <th scope="col" className="px-2 py-2 text-right">GD</th>
              <th scope="col" className="px-2 py-2 text-right">Pts</th>
              <th scope="col" className="hidden px-2 py-2 sm:table-cell">Form</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {table.map((t) => {
              const on = highlight.has(t.id);
              const gd = t.gf - t.ga;
              return (
                <tr key={t.id} className={cn("border-t border-line", on && "bg-surface-2")} aria-current={on ? "true" : undefined}>
                  <td className="px-2 py-2 text-right font-mono text-ink-3">{t.position}</td>
                  <td className="px-2 py-2">
                    <Link to={`/team/${t.id}`} className={cn("flex items-center gap-2 hover:underline", on ? "font-semibold text-ink" : "text-ink-2")}>
                      <Crest teamId={t.id} size={16} />
                      <span className="truncate">{t.short}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-ink-2">{t.played}</td>
                  <td className="px-2 py-2 text-right font-mono text-ink-2">{t.won}</td>
                  <td className="px-2 py-2 text-right font-mono text-ink-2">{t.drawn}</td>
                  <td className="px-2 py-2 text-right font-mono text-ink-2">{t.lost}</td>
                  <td className="px-2 py-2 text-right font-mono text-ink-2">{gd > 0 ? `+${gd}` : gd}</td>
                  <td className="px-2 py-2 text-right font-mono font-semibold text-ink">{t.points}</td>
                  <td className="hidden px-2 py-2 sm:table-cell">{t.form ? <FormPills form={t.form} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Source>League table · football-data.org</Source>
    </Card>
  );
}

export function HeadToHeadTab({ detail, matches }: { detail: MatchDetail; matches: Match[] }) {
  const home = getTeam(detail.homeId);
  const away = getTeam(detail.awayId);
  const h2h = headToHead(home.id, away.id, matches, detail.id);
  const tiles = [
    { label: `${home.short} wins`, value: h2h.homeWins, teamId: home.id },
    { label: "Draws", value: h2h.draws },
    { label: `${away.short} wins`, value: h2h.awayWins, teamId: away.id },
  ];
  return (
    <div className="space-y-6">
      <Card className="p-4 md:p-5">
        <SectionHeader eyebrow="Earlier meetings" title="Head-to-head" className="mb-4" />
        {h2h.meetings.length === 0 ? (
          <p className="text-caption leading-relaxed text-ink-3">
            No earlier meetings in our synced data. FootIQ only holds results from the seasons it syncs, not the all-time record.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-lg bg-surface-2 px-3 py-3 text-center">
                  <p className="tabular font-mono text-2xl font-bold text-ink">{t.value}</p>
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-micro uppercase tracking-wide text-ink-3">
                    {t.teamId && <Crest teamId={t.teamId} size={14} />}
                    <span className="truncate">{t.label}</span>
                  </p>
                </div>
              ))}
            </div>
            <ul className="mt-4 divide-y divide-line">
              {h2h.meetings.map((m) => {
                const mh = getTeam(m.homeId);
                const ma = getTeam(m.awayId);
                return (
                  <li key={m.id}>
                    <Link to={matchPath(m)} className="flex items-center gap-2 px-1.5 py-2.5 text-caption hover:bg-surface-2">
                      <span className="w-14 shrink-0 font-mono text-micro text-ink-3">{shortDate(m.kickoffIso)}</span>
                      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 truncate text-ink-2">
                        {mh.short} <Crest teamId={mh.id} size={16} />
                      </span>
                      <span className="tabular w-12 shrink-0 text-center font-mono font-semibold text-ink">
                        {m.homeScore}–{m.awayScore}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-ink-2">
                        <Crest teamId={ma.id} size={16} /> {ma.short}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-caption text-ink-3">Only meetings from the seasons FootIQ syncs, not the all-time record.</p>
          </>
        )}
        <Source>Results · football-data.org</Source>
      </Card>
    </div>
  );
}
