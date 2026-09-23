/**
 * Fantasy repository — the real FPL gameweek (number, deadline, average and
 * top score) plus FPL's own fixture difficulty ratings. Player picks are
 * derived from the players repository in the page, from real FPL numbers.
 * Live-tier: null until the API answers.
 */
import type { FantasyBoard } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<FantasyBoard | null>({
  name: "fantasy",
  seed: null,
  endpoint: "/api/fantasy",
  // An older API serves the retired demo board; only the FPL shape carries deadlineIso.
  map: (payload) => ((payload as Partial<FantasyBoard> | null)?.gameweek?.deadlineIso ? (payload as FantasyBoard) : null),
});

export const useFantasyState = store.useState;
