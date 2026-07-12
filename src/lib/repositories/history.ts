/** History repository — see players.ts for the pattern. */
import { historicalMoments as seed } from "@/data/history";
import type { HistoricalMoment } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<HistoricalMoment[]>({
  name: "history",
  seed,
  endpoint: "/api/history",
});

export let historicalMoments: HistoricalMoment[] = store.get();
store.onChange((next) => {
  historicalMoments = next;
});

/** Same contract as the original data helper, evaluated over repo state. */
export function searchHistory(query: string): HistoricalMoment[] {
  const q = query.trim().toLowerCase();
  if (!q) return historicalMoments;
  return historicalMoments.filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      m.subtitle.toLowerCase().includes(q) ||
      m.detail.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q)) ||
      String(m.year).includes(q),
  );
}

export const useHistory = store.use;
export const refreshHistory = store.refresh;
