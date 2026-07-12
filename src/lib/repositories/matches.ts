/** Matches repository — see players.ts for the pattern. */
import {
  matches as seed,
  matchDetail as demoMatchDetail,
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
 * Match detail stays demo-derived for now: the backend serves the same
 * dataset, and events/lineups are deterministic derivations of the match id.
 * When a live data provider lands, this becomes a per-id fetch against
 * /api/matches/:id (endpoint already exists) — call sites won't change shape.
 */
export function matchDetail(id: string): MatchDetail {
  return demoMatchDetail(id);
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
