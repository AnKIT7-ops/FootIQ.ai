/**
 * Competitions repository — see players.ts for the pattern.
 *
 * Live-tier, so it seeds EMPTY like matches: which competitions exist and where
 * their season sits is provider truth with no offline answer. `useState()`
 * exposes load status so the UI can tell "no season data" from "still loading".
 */
import type { CompetitionDto } from "@shared/contracts";
import { createRepoStore } from "./store";

const store = createRepoStore<CompetitionDto[]>({
  name: "competitions",
  seed: [],
  endpoint: "/api/competitions",
});

export let competitions: CompetitionDto[] = store.get();
store.onChange((next) => {
  competitions = next;
});

/**
 * The next competition to kick off, among those that haven't started.
 *
 * Drives the off-season empty state: "no matches today" is true but unhelpful
 * in mid-July, when the honest and useful answer is "the season starts on the
 * 21st". Returns null once anything is under way.
 */
export function nextSeasonStart(list: CompetitionDto[] = competitions): CompetitionDto | null {
  const pending = list
    .filter((c) => c.season?.state === "upcoming")
    .sort((a, b) => a.season!.startDateIso.localeCompare(b.season!.startDateIso));
  return pending[0] ?? null;
}

export const useCompetitions = store.use;
export const useCompetitionsState = store.useState;
export const refreshCompetitions = store.refresh;
