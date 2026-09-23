import { describe, expect, it } from "vitest";
import type { Player } from "@/data/types";
import { MIN_MINUTES, percentile, similarity, traitScore } from "./player-stats";

const mk = (id: string, position: Player["position"], stats: Partial<Player["stats"]>): Player => ({
  id,
  name: id,
  teamId: "t",
  position,
  role: "",
  age: 25,
  photoUrl: "",
  availability: "available",
  news: "",
  chanceOfPlaying: null,
  stats: {
    starts: 10, minutes: 900, goals: 0, assists: 0, xG: 0, xA: 0, cleanSheets: 0, goalsConceded: 0,
    saves: 0, yellowCards: 0, redCards: 0, tackles: 0, recoveries: 0, cbi: 0, bonus: 0,
    ...stats,
  },
  fantasy: { price: 5, totalPoints: 0, form: 0, pointsPerGame: 0, selectedBy: 0, expectedPoints: 0, transfersIn: 0, transfersOut: 0 },
});

const fws = [mk("a", "FW", { goals: 1 }), mk("b", "FW", { goals: 5 }), mk("c", "FW", { goals: 10 }), mk("d", "FW", { goals: 10 })];
const gks = [mk("g1", "GK", { goalsConceded: 2 }), mk("g2", "GK", { goalsConceded: 15 })];
const all = [...fws, ...gks, mk("tiny", "FW", { minutes: MIN_MINUTES - 1, goals: 9 })];

describe("player-stats", () => {
  it("ranks per 90 within the position, ties count half, small samples excluded from the pool", () => {
    expect(percentile(all, fws[0], "goals")).toBe(13); // 0.5 of 4
    expect(percentile(all, fws[2], "goals")).toBe(75); // 2 below + 2 ties/2
  });

  it("inverts lower-is-better metrics", () => {
    expect(percentile(all, gks[0], "conceded")).toBeGreaterThan(percentile(all, gks[1], "conceded"));
  });

  it("likeness is 100 for identical output and 0 across positions", () => {
    expect(similarity(all, fws[2], fws[3])).toBe(100);
    expect(similarity(all, fws[0], gks[0])).toBe(0);
    expect(similarity(all, fws[0], fws[2])).toBeLessThan(100);
  });

  it("scores traits from their metrics", () => {
    expect(traitScore(all, fws[2], "scoring")).toBeGreaterThan(traitScore(all, fws[0], "scoring"));
  });
});
