/** Teams repository — see players.ts for the pattern. */
import { teams as seed } from "@/data/teams";
import type { Team } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<Team[]>({ name: "teams", seed, endpoint: "/api/teams" });

/** The Home table is labelled Premier League; the synced list spans six competitions. */
export const TABLE_LEAGUE = "Premier League";

// A table is ONE league — positions from different competitions aren't comparable
// (mixing them put five clubs at #1). Falls back to the first league if PL is absent.
const derive = (list: Team[]) => {
  const league = list.some((t) => t.league === TABLE_LEAGUE) ? TABLE_LEAGUE : list[0]?.league;
  return {
    byId: new Map(list.map((t) => [t.id, t])),
    table: list
      .filter((t) => t.league === league)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
  };
};

export let teams: Team[] = store.get();
let d = derive(teams);
export let teamById = d.byId;
export let leagueTable = d.table;

store.onChange((next) => {
  teams = next;
  d = derive(next);
  teamById = d.byId;
  leagueTable = d.table;
});

/**
 * An id we don't hold yet — real matches can land while teams is still the demo
 * seed — must not borrow another club's identity: falling back to teams[0]
 * rendered "Arsenal vs Arsenal" (and duplicate React keys). A neutral stand-in
 * keeps every caller non-null; the synced team replaces it on the next render.
 */
const unknownTeam = (id: string): Team => ({
  id,
  name: "TBC",
  short: "TBC",
  tla: "TBC",
  colors: ["#1d2533", "#eef2f8"],
  stadium: "",
  manager: "",
  league: "",
  position: 0,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  points: 0,
  form: "",
  chemistry: 0,
  style: { formation: "", buildUp: "", press: "", line: "", tempo: 0, width: 0, directness: 0, pressIntensity: 0 },
  styleTags: [],
  aiReport: [],
  trophies: [],
});

export function getTeam(id: string): Team {
  return teamById.get(id) ?? unknownTeam(id);
}

export const useTeams = store.use;
export const useTeamsState = store.useState;
export const refreshTeams = store.refresh;
