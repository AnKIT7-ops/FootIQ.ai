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

export function getTeam(id: string): Team {
  const t = teamById.get(id);
  if (t) return t;
  return teams[0];
}

export const useTeams = store.use;
export const useTeamsState = store.useState;
export const refreshTeams = store.refresh;
