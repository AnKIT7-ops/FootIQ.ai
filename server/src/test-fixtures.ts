import type { Player } from "./data/demo";

/** Test-only players in the FPL-synced shape. Fictional names: tests must never read like real claims. */
const base = (over: Partial<Player> & Pick<Player, "id" | "name" | "teamId" | "position" | "role">): Player => ({
  age: 24,
  photoUrl: "https://example.test/p.png",
  availability: "available",
  news: "",
  chanceOfPlaying: null,
  stats: {
    starts: 5, minutes: 450, goals: 3, assists: 2, xG: 2.6, xA: 1.4, cleanSheets: 1, goalsConceded: 6,
    saves: 0, yellowCards: 1, redCards: 0, tackles: 6, recoveries: 20, cbi: 8, bonus: 4,
  },
  fantasy: {
    price: 8.5, totalPoints: 36, form: 6.1, pointsPerGame: 7.2, selectedBy: 12.4,
    expectedPoints: 5.9, transfersIn: 50_000, transfersOut: 12_000,
  },
  ...over,
});

export const samplePlayers: Player[] = [
  base({ id: "fpl-1001", name: "Sam Fixture", teamId: "ars", position: "FW", role: "Forward" }),
  base({ id: "fpl-1002", name: "Jo Sample", teamId: "liv", position: "MF", role: "Midfielder", age: 21 }),
];
