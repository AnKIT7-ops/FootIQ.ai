/**
 * Players repository — every current Premier League player, synced by the
 * API from the Fantasy Premier League API (server/src/providers/fpl.ts).
 *
 * LIVE-TIER: seeded empty. There is no bundled player data any more — the
 * demo set had invented ratings, wages and bios for real people. Until the
 * API answers, `status` says "loading"; if it can't, pages say so instead of
 * showing anything made up.
 *
 * `export let` bindings are live in ESM: when the store hydrates, every
 * importer sees the fresh arrays/maps on their next read. Pages that must
 * re-render on hydration use `usePlayersState()`.
 */
import type { Player } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<Player[]>({
  name: "players",
  seed: [],
  endpoint: "/api/players",
  // An API older than the FPL sync serves the retired demo shape (no `fantasy`);
  // treat it as "not synced" rather than rendering invented ratings or crashing.
  map: (payload) => (Array.isArray(payload) && payload.every((p) => p && typeof p.fantasy === "object") ? (payload as Player[]) : []),
});

export let players: Player[] = store.get();
export let playerById = new Map(players.map((p) => [p.id, p]));

store.onChange((next) => {
  players = next;
  playerById = new Map(next.map((p) => [p.id, p]));
});

export function getPlayer(id: string): Player | undefined {
  return playerById.get(id);
}

export function playersOf(teamId: string): Player[] {
  return players.filter((p) => p.teamId === teamId);
}

/** Reactive variants for pages that should re-render on hydration. */
export const usePlayers = store.use;
export const usePlayersState = store.useState;
export const refreshPlayers = store.refresh;
