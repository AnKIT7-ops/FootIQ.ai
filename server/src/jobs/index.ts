import * as demo from "../data/demo";
import type { Team } from "../data/demo";
import type { FootballDataProvider, NormalizedCompetition, NormalizedTeam } from "../providers";
import type { SnapshotKind, SnapshotStore } from "../services/snapshots";
import type { AiService } from "../ai/service";
import { prompts } from "../ai/prompts";
import { JobRegistry } from "../jobs/registry";
import { mergeMatches, mergeStandings, mergeTeams, type MatchesGrouped } from "./normalize";
import { fetchHeadlines } from "../providers/news-rss";
import type { NewsHeadline } from "../../../shared/contracts";

export type { Job, JobRun } from "./registry";
export { JobRegistry } from "./registry";
export type { MatchesGrouped } from "./normalize";

/**
 * The scheduled jobs. Each one is a full pipeline pass for its domain:
 * fetch (provider) → validate+normalize (provider/merge) → persist (snapshot:
 * cache + DB). Reads never block on these — the API serves the last snapshot
 * or demo data while a sync runs or fails.
 */
/**
 * How long a snapshot stays fresh enough to skip its sync.
 *
 * The cron fires every 30 minutes, but club identity and season metadata do not
 * change on that cadence — re-fetching them each tick would burn 7 of the
 * free tier's 10 requests/minute for data that is identical. Fixtures and
 * tables have no TTL: every tick refreshes them.
 */
const SNAPSHOT_TTL_MS: Partial<Record<SnapshotKind, number>> = {
  team_identity: 24 * 60 * 60_000,
  competitions: 24 * 60 * 60_000,
};

/** True when the last write is still inside the kind's TTL. */
async function isFresh(snapshots: SnapshotStore, kind: SnapshotKind): Promise<boolean> {
  const ttl = SNAPSHOT_TTL_MS[kind];
  if (!ttl) return false;
  const snap = await snapshots.get(kind);
  if (!snap?.syncedAt) return false;
  const age = Date.now() - new Date(snap.syncedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttl;
}

export function registerJobs(
  registry: JobRegistry,
  deps: {
    provider: FootballDataProvider;
    snapshots: SnapshotStore;
    ai: AiService;
    /** Headline source; injectable so tests never hit the real feeds. */
    fetchNews?: () => Promise<NewsHeadline[]>;
  },
): void {
  const { provider, snapshots, ai } = deps;
  const fetchNews = deps.fetchNews ?? (() => fetchHeadlines());

  registry.register({
    name: "sync_competitions",
    description: "Competitions and current-season state → competitions snapshot (24h TTL)",
    async run() {
      if (!provider.fetchCompetitions) return "provider has no competitions capability";
      if (await isFresh(snapshots, "competitions")) return "skipped — snapshot still fresh (24h TTL)";
      const rows = await provider.fetchCompetitions();
      if (rows.length === 0) throw new Error("competitions sync produced 0 rows — keeping last snapshot");
      await snapshots.set<NormalizedCompetition[]>("competitions", rows, provider.name);
      const now = Date.now();
      const live = rows.filter(
        (c) =>
          c.currentSeason &&
          new Date(c.currentSeason.startDateIso).getTime() <= now &&
          new Date(c.currentSeason.endDateIso).getTime() >= now,
      ).length;
      return `${rows.length} competitions (${live} in progress) (${provider.name})`;
    },
  });

  registry.register({
    name: "sync_team_identity",
    description: "Club crest/venue/founded/colours per competition → team_identity snapshot (24h TTL)",
    async run() {
      if (!provider.fetchTeams) return "provider has no teams capability";
      // A fresh snapshot written before squads were parsed still needs one re-sync.
      const prior = await snapshots.get<NormalizedTeam[]>("team_identity");
      const hasSquads = prior?.payload.some((r) => r.squad?.length) ?? false;
      if (hasSquads && (await isFresh(snapshots, "team_identity"))) return "skipped — snapshot still fresh (24h TTL)";
      const rows = await provider.fetchTeams();
      if (rows.length === 0) throw new Error("teams sync produced 0 rows — keeping last snapshot");
      await snapshots.set<NormalizedTeam[]>("team_identity", rows, provider.name);
      const withCrest = rows.filter((r) => r.crestUrl).length;
      const withCoach = rows.filter((r) => r.coach).length;
      const withSquad = rows.filter((r) => r.squad?.length).length;
      return `${rows.length} clubs (${withCrest} crests, ${withCoach} coaches, ${withSquad} squads) (${provider.name})`;
    },
  });

  registry.register({
    name: "sync_standings",
    description: "League tables for every configured competition, enriched with club identity → teams snapshot",
    async run() {
      if (!provider.fetchStandings) return "provider has no standings capability";
      const rows = await provider.fetchStandings();
      const merged = mergeStandings(rows);
      // An empty merge would blank every team page and the whole table. The
      // provider only returns zero rows on total upstream failure (it already
      // tolerates per-competition errors), so keep the last good snapshot and
      // fail loudly instead of publishing nothing.
      if (merged.length === 0) throw new Error("standings sync produced 0 teams — keeping last snapshot");

      // Re-apply club identity from the cached snapshot on EVERY pass. This
      // rebuild would otherwise drop crests/venues until the next daily fetch.
      // No network: identity is read from cache.
      const identity = (await snapshots.get<NormalizedTeam[]>("team_identity"))?.payload ?? [];
      const enriched = mergeTeams(merged, identity);

      await snapshots.set<Team[]>("teams", enriched, provider.name);
      const leagues = new Set(enriched.map((t) => t.league));
      const crests = enriched.filter((t) => t.crestUrl).length;
      return `${rows.length} rows → ${enriched.length} teams across ${leagues.size} competitions, ${crests} with crests (${provider.name})`;
    },
  });

  registry.register({
    name: "sync_news",
    description: "Real football headlines from BBC Sport, the Guardian and Sky Sports RSS → headlines snapshot",
    async run() {
      const rows = await fetchNews();
      await snapshots.set<NewsHeadline[]>("headlines", rows, "rss");
      const sources = [...new Set(rows.map((r) => r.source))].join(", ");
      return `${rows.length} headlines (${sources})`;
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
      return `${rows.length} rows → ${kept} fixtures (${grouped.live.length}L/${grouped.upcoming.length}U/${grouped.finished.length}F/${grouped.postponed.length}P/${grouped.unconfirmed.length}?), ${discoveredTeams.length} clubs discovered (${provider.name})`;
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
