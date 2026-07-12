import * as demo from "../data/demo";
import type { CacheStore } from "../cache/types";
import type { DataSource, SearchResultDto } from "../../../shared/contracts";
import { ApiError } from "../lib/errors";

/**
 * Football catalog reads (players, teams, matches, news, ...) behind the
 * repository pattern:
 *
 *     route -> CatalogService -> [future: DB / paid football API] -> demo data
 *
 * Today the only source is the bundled demo dataset — the same data the
 * frontend falls back to, so backend-on and backend-off render identically.
 * When a real provider lands it slots in ABOVE the demo source here; routes
 * and the frontend never change. Reads are cheap (in-memory), so no cache
 * round trip is spent on them; `source` is reported so ops can tell what
 * served a response.
 */
export class CatalogService {
  readonly source: DataSource = "demo";
  constructor(private cache: CacheStore) {}

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

  teams() {
    return demo.teams;
  }
  team(id: string) {
    const t = demo.teamById.get(id);
    if (!t) throw ApiError.notFound("Team");
    return t;
  }
  leagueTable() {
    return demo.leagueTable;
  }
  teamPlayers(teamId: string) {
    this.team(teamId); // 404 for unknown team
    return demo.playersOf(teamId);
  }

  matches() {
    return {
      live: demo.liveMatches,
      upcoming: demo.upcomingMatches,
      finished: demo.finishedMatches,
    };
  }
  match(id: string) {
    if (!demo.matchById.has(id)) throw ApiError.notFound("Match");
    return demo.matchDetail(id);
  }

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

  /**
   * Global search. Local scoring over the demo dataset now; the method
   * signature is the contract — swapping in Postgres FTS/Typesense later
   * changes only this body. Results cached briefly (repeat queries are
   * common from the command palette).
   */
  async search(query: string): Promise<SearchResultDto[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const cacheKey = `search:v1:${q.slice(0, 80)}`;
    const cached = await this.cache.get<SearchResultDto[]>(cacheKey);
    if (cached) return cached;

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
    for (const t of demo.teams) {
      const s = Math.max(score(t.name), score(t.tla));
      if (s > 0) results.push({ kind: "team", id: t.id, title: t.name, subtitle: t.league, score: s + 5 });
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
}
