/**
 * Players repository — the canonical access point for player data.
 * Pages import from here, never from @/data/players (enforced by
 * scripts/check-imports.mjs). Seeded with the bundled demo dataset,
 * hydrated from the backend when one is configured.
 *
 * `export let` bindings are live in ESM: when the store hydrates, every
 * importer sees the fresh arrays/maps on their next read — existing
 * synchronous call sites keep working with zero churn.
 */
import { players as seed, attributeLabels } from "@/data/players";
import type { Player } from "@/data/types";
import { createRepoStore } from "./store";

export { attributeLabels }; // pure labels, not data — pass through

const store = createRepoStore<Player[]>({ name: "players", seed, endpoint: "/api/players" });

export let players: Player[] = store.get();
export let playerById = new Map(players.map((p) => [p.id, p]));

store.onChange((next) => {
  players = next;
  playerById = new Map(next.map((p) => [p.id, p]));
});

export function getPlayer(id: string): Player {
  const p = playerById.get(id);
  if (p) return p;
  return players[0]; // same forgiving behavior as the original data helper
}

export function playersOf(teamId: string): Player[] {
  return players.filter((p) => p.teamId === teamId);
}

/** Reactive variant for pages that should re-render on hydration. */
export const usePlayers = store.use;
export const refreshPlayers = store.refresh;
