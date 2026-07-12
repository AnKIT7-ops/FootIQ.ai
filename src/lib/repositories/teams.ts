/** Teams repository — see players.ts for the pattern. */
import { teams as seed } from "@/data/teams";
import type { Team } from "@/data/types";
import { createRepoStore } from "./store";

const store = createRepoStore<Team[]>({ name: "teams", seed, endpoint: "/api/teams" });

const derive = (list: Team[]) => ({
  byId: new Map(list.map((t) => [t.id, t])),
  table: [...list].sort((a, b) => a.position - b.position),
});

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
export const refreshTeams = store.refresh;
