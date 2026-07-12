/** Clips repository — see players.ts for the pattern. */
import { clips as seed, clipCategories } from "@/data/clips";
import type { Clip } from "@/data/types";
import { createRepoStore } from "./store";

export { clipCategories }; // static taxonomy, not data

const store = createRepoStore<Clip[]>({ name: "clips", seed, endpoint: "/api/clips" });

export let clips: Clip[] = store.get();
export let clipById = new Map(clips.map((c) => [c.id, c]));

store.onChange((next) => {
  clips = next;
  clipById = new Map(next.map((c) => [c.id, c]));
});

export const useClips = store.use;
export const refreshClips = store.refresh;
