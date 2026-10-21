import { describe, expect, it } from "vitest";
import type { Match, Player, Team } from "@/data/types";
import { headToHead, keyPlayers, leagueTableFor, recentForm, sameTable, seasonComparison } from "./match-facts";

const m = (id: string, homeId: string, awayId: string, day: number, h?: number, a?: number, status: Match["status"] = "finished"): Match => ({
  id,
  homeId,
  awayId,
  competition: "Premier League",
  status,
  homeScore: h,
  awayScore: a,
  kickoffIso: `2026-09-${String(day).padStart(2, "0")}T15:00:00Z`,
  venue: "",
});

const matches: Match[] = [
  m("1", "ars", "che", 1, 2, 0),
  m("2", "liv", "ars", 8, 1, 1),
  m("3", "ars", "mci", 15, 0, 3),
  m("4", "che", "ars", 22, 1, 2),
  m("5", "ars", "tot", 29, undefined, undefined, "upcoming"),
  m("6", "che", "ars", 25, undefined, undefined, "postponed"),
];

describe("recentForm", () => {
  it("lists finished results before the match on screen, newest first", () => {
    const form = recentForm("ars", matches, "2026-09-29T15:00:00Z");
    expect(form.map((f) => f.result)).toEqual(["W", "L", "D", "W"]);
    expect(form[0]).toMatchObject({ opponentId: "che", atHome: false, goalsFor: 2, goalsAgainst: 1 });
  });

  it("ignores results after the match on screen and caps the count", () => {
    expect(recentForm("ars", matches, "2026-09-10T00:00:00Z").map((f) => f.match.id)).toEqual(["2", "1"]);
    expect(recentForm("ars", matches, undefined, 2)).toHaveLength(2);
  });
});

describe("headToHead", () => {
  it("counts wins for the club at home on screen, whichever side it played on", () => {
    const h2h = headToHead("ars", "che", matches, "5");
    expect(h2h.meetings.map((x) => x.id)).toEqual(["4", "1"]);
    expect(h2h).toMatchObject({ homeWins: 2, draws: 0, awayWins: 0 });
    expect(headToHead("che", "ars", matches)).toMatchObject({ homeWins: 0, awayWins: 2 });
  });
});

const team = (id: string, league: string, position: number, extra: Partial<Team> = {}): Team =>
  ({ id, name: id, league, position, played: 5, won: 3, drawn: 1, lost: 1, gf: 9, ga: 4, points: 10, ...extra }) as Team;

describe("leagueTableFor", () => {
  it("returns only that competition's clubs in table order, and nothing for a cup", () => {
    const teams = [team("b", "Premier League", 2), team("a", "Premier League", 1), team("x", "La Liga", 1), team("z", "Premier League", 0)];
    expect(leagueTableFor("Premier League", teams).map((t) => t.id)).toEqual(["a", "b"]);
    expect(leagueTableFor("UEFA Champions League", teams)).toEqual([]);
  });

  it("refuses a partial table (positions with gaps), and sameTable needs both clubs in a complete one", () => {
    const teams = [team("p", "PL", 1), team("q", "PL", 2), team("c1", "UCL", 5), team("c2", "UCL", 27)];
    expect(leagueTableFor("UCL", teams)).toEqual([]);
    expect(sameTable("PL", "p", "q", teams)).toBe(true);
    expect(sameTable("UCL", "c1", "c2", teams)).toBe(false);
    expect(sameTable("PL", "p", "c1", teams)).toBe(false);
  });
});

describe("seasonComparison", () => {
  it("derives per-game rates from the table row", () => {
    const rows = seasonComparison(team("a", "PL", 1), team("b", "PL", 2, { points: 5, gf: 5 }));
    expect(rows[0]).toMatchObject({ label: "Points per game", home: 2, away: 1 });
    expect(rows[1].away).toBe(1);
  });

  it("is empty before both clubs have played", () => {
    expect(seasonComparison(team("a", "PL", 1, { played: 0 }), team("b", "PL", 2))).toEqual([]);
  });
});

describe("keyPlayers", () => {
  const p = (id: string, goals: number, assists: number, minutes: number): Player =>
    ({ id, teamId: "ars", stats: { goals, assists, minutes } }) as Player;

  it("ranks by goals + assists and skips players who haven't played", () => {
    const list = [p("a", 1, 1, 400), p("b", 3, 2, 500), p("c", 0, 0, 0), p("d", 2, 0, 300)];
    expect(keyPlayers("ars", list).map((x) => x.id)).toEqual(["b", "d", "a"]);
  });
});
