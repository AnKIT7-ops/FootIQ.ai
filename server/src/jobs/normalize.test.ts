import { describe, expect, it } from "vitest";
import { mergeMatches, mergeStandings, mergeTeams } from "./normalize";
import { matchDetailFor } from "../../../src/data/matches";
import type { NormalizedTeamStanding } from "../providers/types";

const row = (over: Partial<NormalizedTeamStanding> & { name: string; position: number }): NormalizedTeamStanding => ({
  extId: `fd-${over.name.toLowerCase().replace(/\W/g, "")}`,
  competition: "Premier League",
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  points: 0,
  ...over,
});

describe("mergeStandings", () => {
  it("returns only the synced competition — never demo clubs from other leagues", () => {
    // The bug this guards: demo teams used to be appended to the snapshot that
    // feeds the league table, so Real Madrid (La Liga, 73 fabricated pts) sat
    // atop a provider-sourced Premier League table of real teams on 0 pts.
    const merged = mergeStandings([row({ name: "Arsenal", position: 1 }), row({ name: "AFC Bournemouth", position: 2 })]);

    expect(merged).toHaveLength(2);
    const ids = merged.map((t) => t.id);
    for (const outsider of ["rma", "bar", "bay", "psg"]) {
      expect(ids).not.toContain(outsider);
    }
    expect(merged.every((t) => t.league === "Premier League")).toBe(true);
  });

  it("overlays provider numbers onto a matched demo team, keeping its identity", () => {
    const [arsenal] = mergeStandings([row({ name: "Arsenal", position: 4, played: 3, points: 7, gf: 5, ga: 2 })]);

    expect(arsenal.id).toBe("ars"); // demo identity (squad, colors, crest) survives
    expect(arsenal.name).toBe("Arsenal");
    expect(arsenal.points).toBe(7); // provider truth wins over demo's 69
    expect(arsenal.played).toBe(3);
    expect(arsenal.position).toBe(4);
  });

  it("synthesizes an unseen team under the real competition name, not a placeholder", () => {
    const [bournemouth] = mergeStandings([row({ name: "AFC Bournemouth", position: 9, competition: "Premier League" })]);

    expect(bournemouth.league).toBe("Premier League");
    expect(bournemouth.league).not.toBe("Synced League");
  });

  it("returns nothing when the provider returns nothing — never demo teams", () => {
    // Inverted deliberately. This used to return the full demo dataset, which
    // made "the sync found no standings" indistinguishable from "here are the
    // standings" — the caller sees the same shape either way and cannot tell
    // it is holding fiction. Empty in, empty out; the caller decides what to
    // render for empty.
    expect(mergeStandings([])).toEqual([]);
  });

  it("builds match detail for a synced fixture whose clubs are not in the demo set", () => {
    // Regression: matchDetailFor defaulted to the demo team lookup, which
    // throws "Unknown team" for a provider id like "fd-78" (Atlético). That
    // blanked the homepage and made /api/matches/:id a 500 for EVERY real
    // fixture — invisible to typecheck and to every test, because both sides
    // of the call were individually correct.
    const teams = mergeStandings([
      { ...row({ name: "Atlético Madrid", position: 1 }), extId: "fd-78" },
      { ...row({ name: "Villarreal CF", position: 2 }), extId: "fd-94" },
    ]);
    const byId = new Map(teams.map((t) => [t.id, t]));
    const { grouped } = mergeMatches(
      [
        { extId: "fd-1", homeExtId: "fd-78", awayExtId: "fd-94", homeName: "Atlético Madrid", awayName: "Villarreal CF", competition: "Primera Division", status: "upcoming", kickoffIso: "2026-08-16T15:00:00Z" },
        { extId: "fd-2", homeExtId: "fd-78", awayExtId: "fd-94", homeName: "Atlético Madrid", awayName: "Villarreal CF", competition: "Primera Division", status: "finished", kickoffIso: "2026-07-05T15:00:00Z", homeScore: 2, awayScore: 1 },
      ],
      teams,
    );
    const resolve = (id: string) => byId.get(id)!;

    // The crash: resolving a synced club at all.
    const upcoming = matchDetailFor(grouped.upcoming[0], resolve);
    expect(upcoming.homeId).toBe("fd-78");

    // ...and an unplayed fixture invents no play. Momentum, stats, lineups and
    // events are claims about a match that hasn't happened.
    expect(upcoming.events).toEqual([]);
    expect(upcoming.momentum).toEqual([]);
    expect(upcoming.home.possession).toBe(0);
    expect(upcoming.homeLineup.players).toEqual([]);

    // A finished match still gets its derived detail.
    const finished = matchDetailFor(grouped.finished[0], resolve);
    expect(finished.home.possession).toBeGreaterThan(0);
    expect(finished.events.length).toBeGreaterThan(0);
  });

  it("enriches a club with provider identity without re-keying its id", () => {
    // The id is a join key: demo players reference their club by it. Re-keying
    // teams to provider ids would orphan every player and empty every squad.
    const teams = mergeStandings([row({ name: "Arsenal", position: 1 })]);
    const [arsenal] = mergeTeams(teams, [
      {
        extId: teams[0].extId!,
        name: "Arsenal FC",
        crestUrl: "https://crests.football-data.org/57.png",
        venue: "Emirates Stadium",
        founded: 1886,
        clubColors: "Red / White",
        competition: "Premier League",
      },
    ]);

    expect(arsenal.id).toBe("ars"); // join key intact
    expect(arsenal.crestUrl).toBe("https://crests.football-data.org/57.png");
    expect(arsenal.founded).toBe(1886);
    expect(arsenal.stadium).toBe("Emirates Stadium");
    expect(arsenal.colors[0]).toBe("#e11d48"); // "Red / White" parsed
  });

  it("carries the provider's real squad onto known and new clubs", () => {
    // Team pages used to render generated filler names; the real squad must survive the merge.
    const squad = [{ name: "Bukayo Saka", position: "Right Winger", dateOfBirth: "2001-09-05", nationality: "England" }];
    const teams = mergeStandings([row({ name: "Arsenal", position: 1 })]);
    const merged = mergeTeams(teams, [
      { extId: teams[0].extId!, name: "Arsenal FC", competition: "Premier League", squad },
      { extId: "fd-341", name: "Leeds United FC", competition: "Premier League", squad },
    ]);
    expect(merged.find((t) => t.id === "ars")?.squad).toEqual(squad);
    expect(merged.find((t) => t.extId === "fd-341")?.squad).toEqual(squad);
  });

  it("keeps a club's squad when a second competition lists it with an empty one", () => {
    // Arsenal is fetched under PL (full squad) and CL (squad: [] on the free tier).
    const squad = [{ name: "Bukayo Saka", position: "Right Winger" }];
    const teams = mergeStandings([row({ name: "Arsenal", position: 1 })]);
    const [arsenal] = mergeTeams(teams, [
      { extId: teams[0].extId!, name: "Arsenal FC", competition: "Premier League", squad, founded: 1886 },
      { extId: teams[0].extId!, name: "Arsenal FC", competition: "UEFA Champions League", squad: [] },
    ]);
    expect(arsenal.squad).toEqual(squad);
    expect(arsenal.founded).toBe(1886); // earlier rows' fields survive too
  });

  it("files an identity-only club under the competition NAME, never its code", () => {
    // Standings file competitions by name ("Primera Division"); the teams
    // endpoint is called by code ("PD"). Using the code here put both in the
    // league picker as if they were two different competitions.
    const merged = mergeTeams([], [
      { extId: "fd-500", name: "Málaga CF", competition: "Primera Division", crestUrl: "https://x/500.png" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].league).toBe("Primera Division");
    expect(merged[0].league).not.toBe("PD");
  });

  it("keeps one row per club when a team appears in several competitions", () => {
    // Arsenal is in both the Premier League and the Champions League tables and
    // football-data returns the same team id for both. Domestic syncs first, so
    // the domestic league is the one that sticks.
    const merged = mergeStandings([
      { ...row({ name: "Arsenal", position: 1, points: 30 }), extId: "fd-57" },
      { ...row({ name: "Arsenal", position: 12, points: 8, competition: "UEFA Champions League" }), extId: "fd-57" },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].league).toBe("Premier League");
    expect(merged[0].points).toBe(30);
  });
});
