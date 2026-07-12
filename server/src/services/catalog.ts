import * as demo from "../data/demo";
import { matchDetailFor } from "../../../src/data/matches";
import type { Match, MatchDetail, Team } from "../data/demo";
import type { CacheStore } from "../cache/types";
import type { SnapshotStore } from "./snapshots";
import type { DataSource, SearchResultDto } from "../../../shared/contracts";
import { ApiError } from "../lib/errors";

interface Sourced<T> {
  data: T;
  source: DataSource;
}

interface MatchesGrouped {
  live: Match[];
  upcoming: Match[];
  finished: Match[];
}

/**
 * Football catalog reads behind the repository pattern:
 *
 *     route -> CatalogService -> snapshot (cache -> DB, provider-synced) -> demo data
 *
 * Snapshot-backed domains (teams, standings, matches) report where the data
 * came from per response: "provider" when a sync job wrote it from a real
 * source, "demo" otherwise. Player-level depth (attributes, xG, bios) stays
 * demo/derived until a stats-capable provider lands — by design, the shapes
 * never change, only the truth inside them.
 */
export class CatalogService {
  constructor(
    private cache: CacheStore,
    private snapshots: SnapshotStore,
  ) {}

  private async teamsSourced(): Promise<Sourced<Team[]>> {
    const snap = await this.snapshots.get<Team[]>("teams");
    if (snap && snap.payload.length > 0 && snap.source !== "demo") {
      return { data: snap.payload, source: "provider" };
    }
    return { data: demo.teams, source: "demo" };
  }

  private async matchesSourced(): Promise<Sourced<MatchesGrouped>> {
    const snap = await this.snapshots.get<MatchesGrouped>("matches");
    if (snap && snap.source !== "demo") {
      const g = snap.payload;
      if (g.live.length + g.upcoming.length + g.finished.length > 0) {
        return { data: g, source: "provider" };
      }
    }
    return {
      data: { live: demo.liveMatches, upcoming: demo.upcomingMatches, finished: demo.finishedMatches },
      source: "demo",
    };
  }

  // ---- players (demo-depth until a stats provider exists) -------------------

  players() {
    return demo.players;
  }
  player(id: string) {
    const p = demo.playerById.get(id);
    if (!p) throw ApiError.notFound("Player");
    return p;
  }
  similarPlayers(id: string) {
    const p = this.player(id);
    return p.similar.map((sid) => demo.playerById.get(sid)).filter(Boolean);
  }

  // ---- teams / standings (snapshot-backed) -----------------------------------

  async teams(): Promise<Sourced<Team[]>> {
    return this.teamsSourced();
  }

  async team(id: string): Promise<Sourced<Team>> {
    const { data, source } = await this.teamsSourced();
    const t = data.find((x) => x.id === id) ?? demo.teamById.get(id);
    if (!t) throw ApiError.notFound("Team");
    return { data: t, source };
  }

  async leagueTable(): Promise<Sourced<Team[]>> {
    const { data, source } = await this.teamsSourced();
    return { data: [...data].sort((a, b) => a.position - b.position), source };
  }

  async teamPlayers(id: string) {
    await this.team(id); // 404 for unknown team
    return demo.playersOf(id); // synced-only teams have no demo squad — empty is honest
  }

  // ---- matches (snapshot-backed) ----------------------------------------------

  async matches(): Promise<Sourced<MatchesGrouped>> {
    return this.matchesSourced();
  }

  async match(id: string): Promise<Sourced<MatchDetail>> {
    if (demo.matchById.has(id)) return { data: demo.matchDetail(id), source: "demo" };
    const { data, source } = await this.matchesSourced();
    const m = [...data.live, ...data.upcoming, ...data.finished].find((x) => x.id === id);
    if (!m) throw ApiError.notFound("Match");
    return { data: matchDetailFor(m), source };
  }

  // ---- demo-tier domains ---------------------------------------------------------

  news() {
    return demo.news;
  }
  article(id: string) {
    const n = demo.newsById.get(id);
    if (!n) throw ApiError.notFound("Article");
    return n;
  }
  transfers() {
    return demo.trendingTransfers;
  }
  predictions() {
    return demo.predictions;
  }
  prediction(matchId: string) {
    const p = demo.predictionByMatch.get(matchId);
    if (!p) throw ApiError.notFound("Prediction");
    return p;
  }
  clips() {
    return demo.clips;
  }
  history() {
    return demo.historicalMoments;
  }
  fantasy() {
    return {
      gameweek: demo.gameweek,
      captainPicks: demo.captainPicks,
      differentials: demo.differentials,
      transferTips: demo.transferTips,
      injuryAlerts: demo.injuryAlerts,
      fixtureDifficulty: demo.fixtureDifficulty,
    };
  }

  // ---- search --------------------------------------------------------------------

  /**
   * Global search over the LIVE catalog (snapshot teams included). Local
   * scoring now; swapping in Postgres FTS/Typesense changes only this body.
   */
  async search(query: string): Promise<SearchResultDto[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const cacheKey = `search:v2:${q.slice(0, 80)}`;
    const cached = await this.cache.get<SearchResultDto[]>(cacheKey);
    if (cached) return cached;

    const { data: teams } = await this.teamsSourced();
    const results: (SearchResultDto & { score: number })[] = [];
    const score = (text: string): number => {
      const t = text.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 60;
      if (t.includes(q)) return 30;
      return 0;
    };

    for (const p of demo.players) {
      const s = Math.max(score(p.name), score(p.role) / 2);
      if (s > 0) {
        results.push({
          kind: "player",
          id: p.id,
          title: p.name,
          subtitle: `${p.position} · ${demo.teamById.get(p.teamId)?.name ?? ""}`,
          score: s + 10, // players are the primary entity
        });
      }
    }
    for (const t of teams) {
      const s = Math.max(score(t.name), score(t.tla));
      if (s > 0) results.push({ kind: "team", id: t.id, title: t.name, subtitle: t.league, score: s + 5 });
      if (t.manager && t.manager !== "—") {
        const ms = score(t.manager);
        if (ms > 0) results.push({ kind: "manager", id: t.id, title: t.manager, subtitle: `Manager · ${t.name}`, score: ms });
      }
    }
    for (const n of demo.news) {
      const s = score(n.title) / 2;
      if (s > 0) results.push({ kind: "news", id: n.id, title: n.title, subtitle: n.category, score: s });
    }

    const top = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ score: _s, ...r }) => r);
    await this.cache.set(cacheKey, top, 600);
    return top;
  }

  /** Autocomplete: prefix-first, tiny payload, heavily cached. */
  async suggest(query: string): Promise<SearchResultDto[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const cacheKey = `suggest:v1:${q.slice(0, 40)}`;
    const cached = await this.cache.get<SearchResultDto[]>(cacheKey);
    if (cached) return cached;

    const { data: teams } = await this.teamsSourced();
    const out: SearchResultDto[] = [];
    // word-prefix matching: "art" hits "Mikel Arteta", "united" hits "Manchester United"
    const starts = (t: string) => {
      const lower = t.toLowerCase();
      return lower.startsWith(q) || lower.split(/\s+/).some((w) => w.startsWith(q));
    };

    for (const p of demo.players) if (starts(p.name)) out.push({ kind: "player", id: p.id, title: p.name, subtitle: p.position });
    for (const t of teams) {
      if (starts(t.name) || starts(t.tla)) out.push({ kind: "team", id: t.id, title: t.name, subtitle: t.league });
      if (t.manager !== "—" && starts(t.manager)) out.push({ kind: "manager", id: t.id, title: t.manager, subtitle: t.name });
    }

    const top = out.slice(0, 8);
    await this.cache.set(cacheKey, top, 1800);
    return top;
  }
}
