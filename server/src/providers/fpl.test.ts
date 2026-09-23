import { describe, expect, it } from "vitest";
import { ageOn, normalizeFpl } from "./fpl";
import type { Team } from "../data/demo";

const el = (over: Record<string, unknown>) => ({
  code: 100, first_name: "Test", second_name: "Player", team: 1, element_type: 3, birth_date: "2000-06-15",
  status: "a", news: "", chance_of_playing_next_round: null, now_cost: 65, total_points: 30, form: "5.5",
  points_per_game: "6.0", selected_by_percent: "12.3", ep_next: "4.8", transfers_in_event: 10, transfers_out_event: 2,
  starts: 5, minutes: 450, goals_scored: 2, assists: 1, expected_goals: "1.77", expected_assists: "0.86",
  clean_sheets: 1, goals_conceded: 5, saves: 0, yellow_cards: 1, red_cards: 0, tackles: 7, recoveries: 10,
  clearances_blocks_interceptions: 9, bonus: 3,
  ...over,
});

const bootstrap = {
  teams: [
    { id: 1, name: "Arsenal", short_name: "ARS" },
    { id: 2, name: "Nott'm Forest", short_name: "NFO" },
    { id: 3, name: "Nowhere FC", short_name: "NWH" },
  ],
  events: [
    { id: 5, deadline_time: "2026-09-19T10:00:00Z", is_current: true, is_next: false, average_entry_score: 48, highest_score: 126 },
    { id: 6, deadline_time: "2026-10-10T10:00:00Z", is_current: false, is_next: true, average_entry_score: null, highest_score: null },
  ],
  elements: [
    el({ code: 1 }),
    el({ code: 2, team: 2, element_type: 1, status: "d", news: "Knock - 75% chance of playing", chance_of_playing_next_round: 75 }),
    el({ code: 3, status: "u", news: "Has joined another club permanently" }), // left the club
    el({ code: 4, team: 3 }), // club we can't resolve
  ],
};

const fixtures = [
  { event: 6, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4 },
  { event: 12, team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3 }, // outside the 5-gameweek window
];

const teams = [
  { id: "ars", tla: "ARS", league: "Premier League" },
  { id: "fd-351", tla: "NOT", league: "Premier League" },
  { id: "rma", tla: "RMA", league: "La Liga" },
] as Team[];

describe("normalizeFpl", () => {
  const out = normalizeFpl(bootstrap, fixtures, teams, new Date("2026-09-23T00:00:00Z"));

  it("keeps current players only, resolving clubs by TLA (with FPL's NFO alias)", () => {
    expect(out.players.map((p) => p.id)).toEqual(["fpl-1", "fpl-2"]);
    expect(out.players[1].teamId).toBe("fd-351");
    expect(out.unmatchedClubs).toEqual(["Nowhere FC"]);
  });

  it("maps real fields and coerces FPL's string decimals", () => {
    const [mid, gk] = out.players;
    expect(mid).toMatchObject({ position: "MF", role: "Midfielder", age: 26, availability: "available" });
    expect(mid.stats).toMatchObject({ xG: 1.77, xA: 0.86, cbi: 9 });
    expect(mid.fantasy).toMatchObject({ price: 6.5, form: 5.5, selectedBy: 12.3, expectedPoints: 4.8 });
    expect(gk).toMatchObject({ position: "GK", availability: "doubtful", chanceOfPlaying: 75, news: "Knock - 75% chance of playing" });
  });

  it("picks the next gameweek, with the last played one's scores, and a 5-week difficulty window", () => {
    expect(out.board.gameweek).toEqual({ number: 6, deadlineIso: "2026-10-10T10:00:00Z", averageScore: 48, highestScore: 126 });
    const ars = out.board.fixtureDifficulty.find((f) => f.teamId === "ars")!;
    expect(ars.fixtures).toEqual([{ gameweek: 6, opponentId: "fd-351", home: true, difficulty: 2 }]);
  });

  it("fails loudly on schema drift instead of publishing garbage", () => {
    expect(() => normalizeFpl({ ...bootstrap, elements: [{ code: "x" }] }, fixtures, teams)).toThrow();
  });
});

describe("ageOn", () => {
  it("counts birthdays exactly", () => {
    expect(ageOn("2000-09-23", new Date("2026-09-22T00:00:00Z"))).toBe(25);
    expect(ageOn("2000-09-23", new Date("2026-09-23T00:00:00Z"))).toBe(26);
    expect(ageOn(null, new Date())).toBeNull();
  });
});
