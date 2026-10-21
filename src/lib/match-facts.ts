/**
 * Match facts from data FootIQ already syncs for free: results, the league
 * table and FPL season stats. Everything here is a measured fact or a plain
 * arithmetic summary of one — no events feed, no inference.
 *
 * Pure functions over plain arrays so they test without the repositories.
 */
import type { Match, Player, Team } from "@/data/types";

export type Result = "W" | "D" | "L";

export interface FormEntry {
  match: Match;
  opponentId: string;
  atHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: Result;
}

const hasScore = (m: Match): m is Match & { homeScore: number; awayScore: number } =>
  m.homeScore != null && m.awayScore != null;

/** Finished, scored, and kicked off before `beforeIso` (the match on screen). */
const playedBefore = (m: Match, beforeIso?: string) =>
  m.status === "finished" && hasScore(m) && (!beforeIso || m.kickoffIso < beforeIso);

const newestFirst = (a: Match, b: Match) => b.kickoffIso.localeCompare(a.kickoffIso);

/** A team's last `n` results before the match on screen, newest first. */
export function recentForm(teamId: string, matches: Match[], beforeIso?: string, n = 5): FormEntry[] {
  return matches
    .filter((m) => (m.homeId === teamId || m.awayId === teamId) && playedBefore(m, beforeIso))
    .sort(newestFirst)
    .slice(0, n)
    .map((m) => {
      const atHome = m.homeId === teamId;
      const goalsFor = (atHome ? m.homeScore : m.awayScore) as number;
      const goalsAgainst = (atHome ? m.awayScore : m.homeScore) as number;
      return {
        match: m,
        opponentId: atHome ? m.awayId : m.homeId,
        atHome,
        goalsFor,
        goalsAgainst,
        result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
      };
    });
}

export interface HeadToHead {
  meetings: Match[];
  homeWins: number;
  draws: number;
  awayWins: number;
}

/**
 * Earlier finished meetings between the two clubs, newest first. `homeWins`
 * counts wins for the club that is at home in the match on screen, whichever
 * side it played on in the earlier meeting.
 */
export function headToHead(homeId: string, awayId: string, matches: Match[], excludeId?: string): HeadToHead {
  const meetings = matches
    .filter(
      (m) =>
        m.id !== excludeId &&
        m.status === "finished" &&
        hasScore(m) &&
        ((m.homeId === homeId && m.awayId === awayId) || (m.homeId === awayId && m.awayId === homeId)),
    )
    .sort(newestFirst);
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  for (const m of meetings) {
    const forHome = m.homeId === homeId ? m.homeScore! - m.awayScore! : m.awayScore! - m.homeScore!;
    if (forHome > 0) homeWins++;
    else if (forHome < 0) awayWins++;
    else draws++;
  }
  return { meetings, homeWins, draws, awayWins };
}

/**
 * The competition's full league table, or [] when we don't hold a complete one.
 * Clubs carry one `league` each, so a European competition only lists the clubs
 * with no domestic league in our data (positions like 5, 9, 27): a partial
 * table that would read as the real standings. Positions must run 1..n.
 */
export function leagueTableFor(competition: string, teams: Team[]): Team[] {
  const table = teams
    .filter((t) => t.league === competition && t.position > 0)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return table.every((t, i) => t.position === i + 1) ? table : [];
}

/** Both clubs sit in the same complete table for this competition, so their rows compare like for like. */
export function sameTable(competition: string, homeId: string, awayId: string, teams: Team[]): boolean {
  const table = leagueTableFor(competition, teams);
  return table.some((t) => t.id === homeId) && table.some((t) => t.id === awayId);
}

export interface SeasonRow {
  label: string;
  home: number;
  away: number;
  format?: (v: number) => string;
}

const perGame = (total: number, played: number) => (played > 0 ? total / played : 0);
const twoDp = (v: number) => v.toFixed(2);

/** Season-to-date comparison straight from the table rows. Empty until both clubs have played. */
export function seasonComparison(home: Team, away: Team): SeasonRow[] {
  if (home.played === 0 || away.played === 0) return [];
  return [
    { label: "Points per game", home: perGame(home.points, home.played), away: perGame(away.points, away.played), format: twoDp },
    { label: "Goals scored per game", home: perGame(home.gf, home.played), away: perGame(away.gf, away.played), format: twoDp },
    { label: "Goals conceded per game", home: perGame(home.ga, home.played), away: perGame(away.ga, away.played), format: twoDp },
    { label: "Wins", home: home.won, away: away.won },
    { label: "Draws", home: home.drawn, away: away.drawn },
    { label: "Losses", home: home.lost, away: away.lost },
  ];
}

/** A club's top contributors by FPL season goals + assists; players who haven't played are skipped. */
export function keyPlayers(teamId: string, players: Player[], n = 3): Player[] {
  return players
    .filter((p) => p.teamId === teamId && p.stats.minutes > 0)
    .sort(
      (a, b) =>
        b.stats.goals + b.stats.assists - (a.stats.goals + a.stats.assists) ||
        b.stats.goals - a.stats.goals ||
        b.stats.minutes - a.stats.minutes,
    )
    .slice(0, n);
}
