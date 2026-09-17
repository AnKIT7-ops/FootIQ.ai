/**
 * Matches repository — see players.ts for the pattern, with one deliberate
 * difference: NO SEED.
 *
 * Every other repository seeds from `src/data/*` so the UI never waits. This
 * one starts empty on purpose. Its seed used to be three hardcoded "live"
 * fixtures (Arsenal 2-1 Liverpool, permanently 67'), which rendered whenever
 * the backend was unreachable — i.e. always, since the backend was never
 * deployed. Real fixtures have no offline answer, so the honest starting state
 * is "nothing yet", and `useMatchesState()` tells the UI whether that means
 * loading, genuinely no matches, or a backend failure.
 *
 * The demo fixtures still exist in `src/data/matches.ts` — the server's
 * DemoProvider serves them through the normal provider contract when
 * DATA_PROVIDER=demo, so they arrive tagged as demo instead of masquerading as
 * live truth.
 */
import { matches as demoMatches, matchById as demoMatchById, matchDetail as demoMatchDetail, matchDetailFor } from "@/data/matches";
import { getTeam } from "./teams";
import type { Match, MatchDetail, MatchStatus } from "@/data/types";
import { createRepoStore } from "./store";

export type MatchesGrouped = Record<MatchStatus, Match[]>;

const EMPTY: MatchesGrouped = { live: [], upcoming: [], finished: [], postponed: [], cancelled: [], unconfirmed: [] };

const store = createRepoStore<MatchesGrouped>({
  name: "matches",
  seed: EMPTY,
  endpoint: "/api/matches",
  // Tolerate a backend that predates the postponed/cancelled/unconfirmed buckets.
  map: (payload) => ({ ...EMPTY, ...(payload as Partial<MatchesGrouped>) }),
});

const flatten = (g: MatchesGrouped): Match[] => [
  ...g.live,
  ...g.upcoming,
  ...g.finished,
  ...g.postponed,
  ...g.cancelled,
  ...g.unconfirmed,
];

export let liveMatches: Match[] = store.get().live;
export let upcomingMatches: Match[] = store.get().upcoming;
export let finishedMatches: Match[] = store.get().finished;
export let postponedMatches: Match[] = store.get().postponed;
export let matches: Match[] = flatten(store.get());
export let matchById = new Map(matches.map((m) => [m.id, m]));

store.onChange((next) => {
  liveMatches = next.live;
  upcomingMatches = next.upcoming;
  finishedMatches = next.finished;
  postponedMatches = next.postponed;
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
  // Resolve against the TEAMS REPOSITORY, not the demo team map: a synced
  // fixture's clubs ("fd-78") exist only there. Passing the demo lookup threw
  // "Unknown team" and blanked the page.
  if (synced) return matchDetailFor(synced, getTeam);
  return demoMatchDetail(id); // unknown id: keep the original throwing behavior (pages catch)
}

/**
 * Look up a fixture by id across BOTH the synced list and the bundled demo set.
 *
 * Demo-tier domains (predictions, fantasy) key off demo fixture ids like
 * "ars-liv". Once this repository stopped seeding itself from the demo data,
 * those ids resolved to nothing and every caller doing `matchById.get(id)!`
 * dereferenced undefined — the Predictions pages threw on load. Callers that
 * may hold a demo-tier id use this; it returns undefined rather than throwing,
 * so a genuinely unknown fixture can be skipped instead of crashing a page.
 */
export function findMatch(id: string): Match | undefined {
  return matchById.get(id) ?? demoMatchById.get(id);
}

/**
 * Every fixture addressable by URL: synced first, then demo fixtures the sync
 * doesn't cover. For slug/id RESOLUTION only — never for listing. `matches`
 * stays synced-only on purpose, and folding demo fixtures into it would put the
 * permanently-live 67th-minute demo match back on every list in the app.
 */
export function resolutionPool(): Match[] {
  return [...matches, ...demoMatches.filter((d) => !matchById.has(d.id))];
}

/** Kicked off and over — including a match whose result the provider never confirmed. */
const played = (m: Match) => m.status === "finished" || m.status === "unconfirmed";

export function teamMatches(teamId: string): { fixtures: Match[]; results: Match[] } {
  return {
    fixtures: matches.filter(
      (m) => (m.homeId === teamId || m.awayId === teamId) && !played(m),
    ),
    results: matches.filter(
      (m) => (m.homeId === teamId || m.awayId === teamId) && played(m),
    ),
  };
}

export const useMatches = store.use;
/** Data + load status — use this anywhere an empty list must not read as "no matches today". */
export const useMatchesState = store.useState;
export const refreshMatches = store.refresh;
