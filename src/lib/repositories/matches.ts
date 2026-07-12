/** Matches repository — see players.ts for the pattern. */
import {
  matches as seed,
  matchById as demoMatchById,
  matchDetail as demoMatchDetail,
  matchDetailFor,
} from "@/data/matches";
import type { Match, MatchDetail } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<{ live: Match[]; upcoming: Match[]; finished: Match[] }>({
  name: "matches",
  seed: {
    live: seed.filter((m) => m.status === "live"),
    upcoming: seed.filter((m) => m.status === "upcoming"),
    finished: seed.filter((m) => m.status === "finished"),
  },
  endpoint: "/api/matches",
});

const flatten = (g: { live: Match[]; upcoming: Match[]; finished: Match[] }) => [
  ...g.live,
  ...g.upcoming,
  ...g.finished,
];

export let liveMatches: Match[] = store.get().live;
export let upcomingMatches: Match[] = store.get().upcoming;
export let finishedMatches: Match[] = store.get().finished;
export let matches: Match[] = flatten(store.get());
export let matchById = new Map(matches.map((m) => [m.id, m]));

store.onChange((next) => {
  liveMatches = next.live;
  upcomingMatches = next.upcoming;
  finishedMatches = next.finished;
  matches = flatten(next);
  matchById = new Map(matches.map((m) => [m.id, m]));
});

/**
 * Match detail: demo ids use the bundled generator; synced (provider) ids —
 * present only in the hydrated list — synthesize detail from their Match
 * object with the same deterministic generators. A per-id fetch against
 * /api/matches/:id can still replace this body without changing call sites.
 */
export function matchDetail(id: string): MatchDetail {
  if (demoMatchById.has(id)) return demoMatchDetail(id);
  const synced = matchById.get(id);
  if (synced) return matchDetailFor(synced);
  return demoMatchDetail(id); // unknown id: keep the original throwing behavior (pages catch)
}

export function teamMatches(teamId: string): { fixtures: Match[]; results: Match[] } {
  return {
    fixtures: matches.filter(
      (m) => (m.homeId === teamId || m.awayId === teamId) && m.status !== "finished",
    ),
    results: matches.filter(
      (m) => (m.homeId === teamId || m.awayId === teamId) && m.status === "finished",
    ),
  };
}

export const useMatches = store.use;
export const refreshMatches = store.refresh;
