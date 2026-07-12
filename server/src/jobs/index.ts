import * as demo from "../data/demo";
import type { Match, Team } from "../data/demo";
import type { FootballDataProvider } from "../providers";
import type { SnapshotStore } from "../services/snapshots";
import type { AiService } from "../ai/service";
import { prompts } from "../ai/prompts";
import { JobRegistry } from "../jobs/registry";
import { mergeMatches, mergeStandings } from "./normalize";

export type { Job, JobRun } from "./registry";
export { JobRegistry } from "./registry";

export interface MatchesGrouped {
  live: Match[];
  upcoming: Match[];
  finished: Match[];
}

/**
 * The scheduled jobs. Each one is a full pipeline pass for its domain:
 * fetch (provider) → validate+normalize (provider/merge) → persist (snapshot:
 * cache + DB). Reads never block on these — the API serves the last snapshot
 * or demo data while a sync runs or fails.
 */
export function registerJobs(
  registry: JobRegistry,
  deps: { provider: FootballDataProvider; snapshots: SnapshotStore; ai: AiService },
): void {
  const { provider, snapshots, ai } = deps;

  registry.register({
    name: "sync_standings",
    description: "League table from the active data provider → teams snapshot",
    async run() {
      if (!provider.fetchStandings) return "provider has no standings capability";
      const rows = await provider.fetchStandings();
      const merged = mergeStandings(rows);
      await snapshots.set<Team[]>("teams", merged, provider.name);
      return `${rows.length} rows → ${merged.length} teams (${provider.name})`;
    },
  });

  registry.register({
    name: "sync_fixtures",
    description: "Fixtures/results window from the active provider → matches snapshot",
    async run() {
      if (!provider.fetchMatches) return "provider has no fixtures capability";
      const rows = await provider.fetchMatches();
      const teams = (await snapshots.get<Team[]>("teams"))?.payload ?? demo.teams;
      const grouped = mergeMatches(rows, teams);
      await snapshots.set<MatchesGrouped>("matches", grouped, provider.name);
      return `${rows.length} rows → ${grouped.live.length}L/${grouped.upcoming.length}U/${grouped.finished.length}F (${provider.name})`;
    },
  });

  registry.register({
    name: "warm_ai_reports",
    description: "Pre-generate scout reports for the top-rated players into the AI cache",
    async run() {
      const top = [...demo.players].sort((a, b) => b.stats.rating - a.stats.rating).slice(0, 5);
      let generated = 0;
      for (const p of top) {
        const result = await ai.run(prompts.scout_report(p, demo.teamById.get(p.teamId) ?? null));
        if (!result.cached) generated++;
      }
      return `${generated} generated, ${top.length - generated} already cached (${ai.providerName})`;
    },
  });
}
