import { describe, expect, it } from "vitest";
import { mergeStandings } from "./normalize";
import * as demo from "../data/demo";
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

  it("falls back to the full demo dataset when the provider returns nothing", () => {
    expect(mergeStandings([])).toEqual(demo.teams);
  });
});
