/** Predictions repository — see players.ts for the pattern. */
import { predictions as seed } from "@/data/predictions";
import type { Prediction } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<Prediction[]>({
  name: "predictions",
  seed,
  endpoint: "/api/predictions",
});

export let predictions: Prediction[] = store.get();
export let predictionByMatch = new Map(predictions.map((p) => [p.matchId, p]));

store.onChange((next) => {
  predictions = next;
  predictionByMatch = new Map(next.map((p) => [p.matchId, p]));
});

export const usePredictions = store.use;
export const refreshPredictions = store.refresh;
