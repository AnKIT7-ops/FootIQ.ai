import * as demo from "../data/demo";
import type { Team } from "../data/demo";
import type { FootballDataProvider } from "../providers";
import type { SnapshotStore } from "../services/snapshots";
import type { AiService } from "../ai/service";
import { prompts } from "../ai/prompts";
import { JobRegistry } from "../jobs/registry";
import { mergeMatches, mergeStandings, type MatchesGrouped } from "./normalize";

export type { Job, JobRun } from "./registry";
export { JobRegistry } from "./registry";
export type { MatchesGrouped } from "./normalize";

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
    description: "League tables for every configured competition → teams snapshot",
    async run() {
      if (!provider.fetchStandings) return "provider has no standings capability";
      const rows = await provider.fetchStandings();
      const merged = mergeStandings(rows);
      // An empty merge would blank every team page and the whole table. The
      // provider only returns zero rows on total upstream failure (it already
      // tolerates per-competition errors), so keep the last good snapshot and
      // fail loudly instead of publishing nothing.
      if (merged.length === 0) throw new Error("standings sync produced 0 teams — keeping last snapshot");
      await snapshots.set<Team[]>("teams", merged, provider.name);
      const leagues = new Set(merged.map((t) => t.league));
      return `${rows.length} rows → ${merged.length} teams across ${leagues.size} competitions (${provider.name})`;
    },
  });

  registry.register({
    name: "sync_fixtures",
    description: "Fixtures/results window for every configured competition → matches snapshot",
    async run() {
      if (!provider.fetchMatches) return "provider has no fixtures capability";
      const rows = await provider.fetchMatches();
      const snap = await snapshots.get<Team[]>("teams");
      // Resolve fixture sides against the SYNCED teams. Falling back to demo
      // teams here would drop every real fixture whose clubs aren't in the
      // 12-team demo set, which looks identical to "no fixtures this week".
      const teams = snap?.payload?.length ? snap.payload : demo.teams;
      const { grouped, discoveredTeams } = mergeMatches(rows, teams);

      // Fixtures can reveal clubs the standings don't list — promoted sides
      // whose league table hasn't rolled over to the new season yet. Fold them
      // into the team snapshot so their fixtures link somewhere real.
      if (discoveredTeams.length > 0 && snap?.payload?.length) {
        await snapshots.set<Team[]>("teams", [...snap.payload, ...discoveredTeams], snap.source);
      }

      await snapshots.set<MatchesGrouped>("matches", grouped, provider.name);
      const kept = Object.values(grouped).reduce((n, list) => n + list.length, 0);
      return `${rows.length} rows → ${kept} fixtures (${grouped.live.length}L/${grouped.upcoming.length}U/${grouped.finished.length}F/${grouped.postponed.length}P), ${discoveredTeams.length} clubs discovered (${provider.name})`;
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
