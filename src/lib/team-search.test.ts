import { describe, expect, it } from "vitest";
import type { Team } from "@/data/types";
import { searchTeams } from "./team-search";

const t = (id: string, name: string, short: string, tla: string) => ({ id, name, short, tla }) as Team;
const teams = [
  t("bay", "FC Bayern München", "Bayern", "FCB"),
  t("ben", "Sport Lisboa e Benfica", "Benfica", "SLB"),
  t("ars", "Arsenal FC", "Arsenal", "ARS"),
  t("ajx", "AFC Ajax", "Ajax", "AJA"),
];

describe("searchTeams", () => {
  it("ignores accents and case", () => {
    expect(searchTeams(teams, "MUNCHEN").map((x) => x.id)).toEqual(["bay"]);
  });
  it("ranks prefix matches before substring matches", () => {
    // "a" prefixes Arsenal/Ajax/AFC; Bayern and Benfica only contain it.
    expect(searchTeams(teams, "a").map((x) => x.id)).toEqual(["ajx", "ars", "bay", "ben"]);
  });
  it("returns nothing for a blank query", () => {
    expect(searchTeams(teams, "   ")).toEqual([]);
  });
});
