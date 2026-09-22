import { describe, expect, it } from "vitest";
import { forecastMatch, leagueBaseline, PRIOR_GAMES } from "@shared/forecast";
import { forecastFixture } from "./forecast";
import type { Match, Team } from "@/data/types";

const rec = (played: number, gf: number, ga: number) => ({ played, gf, ga });

describe("forecastMatch", () => {
  it("returns a full distribution: outcomes sum to exactly 100", () => {
    const f = forecastMatch(rec(5, 12, 3), rec(5, 4, 11), 1.4);
    expect(f.homeWin + f.draw + f.awayWin).toBe(100);
    expect(f.topScores).toHaveLength(5);
  });

  it("identical sides at a neutral baseline favour the home team, not the away", () => {
    const f = forecastMatch(rec(10, 14, 14), rec(10, 14, 14), 1.4);
    expect(f.homeWin).toBeGreaterThan(f.awayWin);
    expect(f.expectedHome).toBeGreaterThan(f.expectedAway);
  });

  it("a stronger attack against a leakier defence is the favourite even away from home", () => {
    const f = forecastMatch(rec(10, 6, 20), rec(10, 28, 5), 1.4);
    expect(f.awayWin).toBeGreaterThan(f.homeWin);
  });

  it("shrinks tiny samples toward the league average", () => {
    // One 5-0 win vs one 0-5 loss: unshrunk ratings would predict ~20 goals.
    const f = forecastMatch(rec(1, 5, 0), rec(1, 0, 5), 1.4);
    expect(f.expectedHome).toBeLessThan(4);
    expect(PRIOR_GAMES).toBeGreaterThan(0);
  });

  it("baseline is goals per team-game and null before a ball is kicked", () => {
    expect(leagueBaseline([rec(2, 3, 1), rec(2, 1, 3)])).toBe(1);
    expect(leagueBaseline([rec(0, 0, 0)])).toBeNull();
  });
});

const team = (id: string, league: string, played = 5, gf = 7, ga = 7) =>
  ({ id, league, played, gf, ga }) as Team;
const match = (homeId: string, awayId: string, competition: string) =>
  ({ id: "m", homeId, awayId, competition, status: "upcoming", kickoffIso: "", venue: "" }) as Match;

describe("forecastFixture", () => {
  const teams = [team("a", "Premier League"), team("b", "Premier League"), team("c", "Bundesliga")];

  it("prices a domestic fixture", () => {
    expect(forecastFixture(match("a", "b", "Premier League"), teams).ok).toBe(true);
  });

  it("refuses a cross-league tie instead of inventing a number", () => {
    const r = forecastFixture(match("a", "c", "UEFA Champions League"), teams);
    expect(r.ok).toBe(false);
  });

  it("refuses when a club is unknown", () => {
    expect(forecastFixture(match("a", "zzz", "Premier League"), teams).ok).toBe(false);
  });
});
