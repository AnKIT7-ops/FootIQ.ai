/** Transfers repository — see players.ts for the pattern. */
import { transferRumors as seed } from "@/data/transfers";
import type { TransferRumor } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<TransferRumor[]>({
  name: "transfers",
  seed,
  endpoint: "/api/transfers",
});

export let transferRumors: TransferRumor[] = store.get();
export let rumorById = new Map(transferRumors.map((r) => [r.id, r]));
export let trendingTransfers = [...transferRumors].sort((a, b) => b.probability - a.probability);

store.onChange((next) => {
  transferRumors = next;
  rumorById = new Map(next.map((r) => [r.id, r]));
  trendingTransfers = [...next].sort((a, b) => b.probability - a.probability);
});

export const useTransfers = store.use;
export const refreshTransfers = store.refresh;
