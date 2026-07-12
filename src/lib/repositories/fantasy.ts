/** Fantasy repository — one payload hydrates every named export. */
import {
  gameweek as seedGameweek,
  captainPicks as seedCaptains,
  differentials as seedDifferentials,
  transferTips as seedTips,
  injuryAlerts as seedAlerts,
  fixtureDifficulty as seedDifficulty,
} from "@/data/fantasy";
import type { FantasyPick } from "@/data/types";
import { createRepoStore } from "./store";

interface FantasyPayload {
  gameweek: typeof seedGameweek;
  captainPicks: FantasyPick[];
  differentials: FantasyPick[];
  transferTips: typeof seedTips;
  injuryAlerts: typeof seedAlerts;
  fixtureDifficulty: Record<string, number[]>;
}

const store = createRepoStore<FantasyPayload>({
  name: "fantasy",
  seed: {
    gameweek: seedGameweek,
    captainPicks: seedCaptains,
    differentials: seedDifferentials,
    transferTips: seedTips,
    injuryAlerts: seedAlerts,
    fixtureDifficulty: seedDifficulty,
  },
  endpoint: "/api/fantasy",
});

export let gameweek = store.get().gameweek;
export let captainPicks = store.get().captainPicks;
export let differentials = store.get().differentials;
export let transferTips = store.get().transferTips;
export let injuryAlerts = store.get().injuryAlerts;
export let fixtureDifficulty = store.get().fixtureDifficulty;

store.onChange((next) => {
  gameweek = next.gameweek;
  captainPicks = next.captainPicks;
  differentials = next.differentials;
  transferTips = next.transferTips;
  injuryAlerts = next.injuryAlerts;
  fixtureDifficulty = next.fixtureDifficulty;
});

export const useFantasy = store.use;
export const refreshFantasy = store.refresh;
