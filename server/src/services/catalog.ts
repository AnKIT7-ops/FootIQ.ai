import * as demo from "../data/demo";
import { matchDetailFor } from "../../../src/data/matches";
import type { FantasyBoard, MatchDetail, Player, Team } from "../data/demo";
import type { MatchesGrouped } from "../jobs/normalize";
import type { NormalizedCompetition } from "../providers/types";
import type { CacheStore } from "../cache/types";
import type { SnapshotStore } from "./snapshots";
import type { CompetitionDto, DataSource, NewsHeadline, SearchResultDto } from "../../../shared/contracts";
import { ApiError } from "../lib/errors";

interface Sourced<T> {
  data: T;
  source: DataSource;
}

/** Squads are ~25 rows per club; list endpoints (loaded on every page) would 5× in size carrying them. */
const withoutSquad = ({ squad: _squad, ...t }: Team): Team => t;

const EMPTY_MATCHES: MatchesGrouped = { live: [], upcoming: [], finished: [], postponed: [], cancelled: [], unconfirmed: [] };

/**
 * Football catalog reads behind the repository pattern:
 *
 *     route -> CatalogService -> snapshot (cache -> DB, provider-synced) -> demo data
 *
 * Snapshot-backed domains (teams, standings, matches) report where the data
 * came from per response: "provider" when a sync job wrote it from a real
 * source, "demo" otherwise. Players and the fantasy board come from the FPL
 * sync only — there is no demo player data to fall back to.
 */
export class CatalogService {
  constructor(
    private cache: CacheStore,
    private snapshots: SnapshotStore,
  ) {}

  /** The synced competition's table, exactly as the sync wrote it. */
  private async teamsSourced(): Promise<Sourced<Team[]>> {
    const snap = await this.snapshots.get<Team[]>("teams");
    if (snap && snap.payload.length > 0 && snap.source !== "demo") {
      return { data: snap.payload, source: "provider" };
    }
    return { data: demo.teams, source: "demo" };
  }

  /**
   * Every team we can resolve: the synced competition plus the demo clubs from
   * other competitions. Lookup, search and browse want this superset; the
   * league table must NOT (mixing leagues is what corrupted the standings).
   */
  private async catalogTeams(): Promise<Sourced<Team[]>> {
    const { data, source } = await this.teamsSourced();
    if (source === "demo") return { data, source };
    const known = new Set(data.map((t) => t.id));
    return { data: [...data, ...demo.teams.filter((t) => !known.has(t.id))], source };
  }

  /**
   * Fixtures from the last sync. No demo fallback: an empty snapshot means the
   * synced competitions genuinely have no matches in the window (routine in the
   * off-season), and a missing snapshot means the sync has not run or is
   * failing. Both are reported honestly — `source: "provider"` with zero
   * matches, or `source: null` for "we have nothing".
   *
   * This used to fall back to demo fixtures whenever the payload was empty,
   * which is precisely the off-season state, so a working sync served a
   * permanently-live demo match under provider provenance.
   */
  private async matchesSourced(): Promise<Sourced<MatchesGrouped> & { syncedAt: string | null }> {
    const snap = await this.snapshots.get<MatchesGrouped>("matches");
    // No snapshot at all = we have no idea what's on. That's an outage, not an
    // empty schedule, so it must NOT return 200 with an empty list — a caller
    // cannot tell those apart, and "no matches today" is a claim we can't back.
    // An empty snapshot, by contrast, is a real answer: the sync ran and the
    // window genuinely holds no fixtures (routine in the off-season).
    if (!snap) throw ApiError.unavailable("Data temporarily unavailable.");
    return {
      data: { ...EMPTY_MATCHES, ...snap.payload },
      source: snap.source === "demo" ? "demo" : "provider",
      syncedAt: snap.syncedAt,
    };
  }

  // ---- players (FPL-synced; no demo fallback) -----------------------------

  /** Every current Premier League player. No snapshot = not synced yet, reported as an outage. */
  async players(): Promise<{ data: Player[]; syncedAt: string }> {
    const snap = await this.snapshots.get<Player[]>("players");
    if (!snap || snap.payload.length === 0) throw ApiError.unavailable("Player data hasn't synced yet.");
    return { data: snap.payload, syncedAt: snap.syncedAt };
  }
  async player(id: string): Promise<Player> {
    const p = (await this.players()).data.find((x) => x.id === id);
    if (!p) throw ApiError.notFound("Player");
    return p;
  }
  /** Search must keep working (teams, news) before the first player sync. */
  private async playersOrEmpty(): Promise<Player[]> {
    return (await this.snapshots.get<Player[]>("players"))?.payload ?? [];
  }
  /** FPL gameweek state + FPL fixture difficulty. Player picks are derived client-side from players. */
  async fantasy(): Promise<{ data: FantasyBoard; syncedAt: string }> {
    const snap = await this.snapshots.get<FantasyBoard>("fantasy");
    if (!snap) throw ApiError.unavailable("Fantasy data hasn't synced yet.");
    return { data: snap.payload, syncedAt: snap.syncedAt };
  }

  // ---- teams / standings (snapshot-backed) -----------------------------------

  async teams(): Promise<Sourced<Team[]>> {
    const { data, source } = await this.catalogTeams();
    return { data: data.map(withoutSquad), source };
  }

  async team(id: string): Promise<Sourced<Team>> {
    const { data, source } = await this.catalogTeams();
    const t = data.find((x) => x.id === id) ?? demo.teamById.get(id);
    if (!t) throw ApiError.notFound("Team");
    return { data: t, source };
  }

  /** Competition names present in the current team snapshot — drives the table's league picker. */
  async competitionNames(): Promise<Sourced<string[]>> {
    const { data, source } = await this.teamsSourced();
    return { data: [...new Set(data.map((t) => t.league).filter(Boolean))], source };
  }

  /**
   * Competitions with their current-season state.
   *
   * `state` is derived here rather than left to callers: every consumer would
   * otherwise re-implement the same two date comparisons, and get the
   * "ended" case wrong the same way (see CompetitionDto).
   */
  async competitions(): Promise<Sourced<CompetitionDto[]> & { syncedAt: string | null }> {
    const snap = await this.snapshots.get<NormalizedCompetition[]>("competitions");
    if (!snap || snap.payload.length === 0) {
      throw ApiError.unavailable("Data temporarily unavailable.");
    }
    const now = Date.now();
    const data = snap.payload.map((c) => {
      const s = c.currentSeason;
      return {
        code: c.code,
        name: c.name,
        type: c.type,
        area: c.area,
        emblemUrl: c.emblemUrl,
        season: s
          ? {
              startDateIso: s.startDateIso,
              endDateIso: s.endDateIso,
              currentMatchday: s.currentMatchday,
              state:
                new Date(s.startDateIso).getTime() > now
                  ? ("upcoming" as const)
                  : new Date(s.endDateIso).getTime() < now
                    ? ("ended" as const)
                    : ("in-progress" as const),
            }
          : undefined,
      };
    });
    return { data, source: snap.source === "demo" ? "demo" : "provider", syncedAt: snap.syncedAt };
  }

  /**
   * A league table is ONE league. Positions are only comparable within a
   * competition, so a mixed list sorted by position is meaningless — it lands
   * two clubs on position 1.
   *
   * Defaults to the first synced competition rather than the biggest: with six
   * competitions the "most teams" heuristic silently returned the Champions
   * League (36 rows) over the Premier League (20), and picked arbitrarily
   * between the leagues tied at 20.
   *
   * Secondary sort by name keeps pre-season tables stable and alphabetical —
   * before a ball is kicked every team is position 1 with 0 points, and
   * position alone gives an arbitrary order that looks like a ranking.
   */
  async leagueTable(competition?: string): Promise<Sourced<Team[]> & { competition: string | null }> {
    const { data, source } = await this.teamsSourced();
    const target = competition ?? data[0]?.league ?? null;
    if (!target) return { data: [], source, competition: null };
    const table = data
      .filter((t) => t.league === target)
      .map(withoutSquad)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    return { data: table, source, competition: target };
  }

  async teamPlayers(id: string): Promise<Player[]> {
    await this.team(id); // 404 for unknown team
    return (await this.players()).data.filter((p) => p.teamId === id);
  }

  // ---- matches (snapshot-backed) ----------------------------------------------

  async matches(): Promise<Sourced<MatchesGrouped> & { syncedAt: string | null }> {
    return this.matchesSourced();
  }

  async match(id: string): Promise<Sourced<MatchDetail>> {
    if (demo.matchById.has(id)) return { data: demo.matchDetail(id), source: "demo" };
    const { data: catalogTeams } = await this.catalogTeams();
    const byId = new Map(catalogTeams.map((t) => [t.id, t]));
    // Synced fixtures reference synced clubs. matchDetailFor defaults to the
    // demo team lookup, which throws on anything outside the 12-team demo set —
    // that made /api/matches/:id a guaranteed 500 for every real fixture.
    const resolveTeam = (teamId: string) => {
      const t = byId.get(teamId);
      if (!t) throw ApiError.notFound("Team");
      return t;
    };
    const { data, source } = await this.matchesSourced();
    const m = [...data.live, ...data.upcoming, ...data.finished, ...data.postponed, ...data.cancelled, ...(data.unconfirmed ?? [])].find(
      (x) => x.id === id,
    );
    if (!m) throw ApiError.notFound("Match");
    return { data: matchDetailFor(m, resolveTeam), source };
  }

  /** Real headlines from the RSS sync. No demo fallback — no snapshot is an outage, not "no news". */
  async headlines(): Promise<{ data: NewsHeadline[]; syncedAt: string }> {
    const snap = await this.snapshots.get<NewsHeadline[]>("headlines");
    if (!snap || snap.payload.length === 0) throw ApiError.unavailable("Data temporarily unavailable.");
    return { data: snap.payload, syncedAt: snap.syncedAt };
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
  predictions() {
    return demo.predictions;
  }
  prediction(matchId: string) {
    const p = demo.predictionByMatch.get(matchId);
    if (!p) throw ApiError.notFound("Prediction");
    return p;
  }
  history() {
    return demo.historicalMoments;
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

    const { data: teams } = await this.catalogTeams();
    const results: (SearchResultDto & { score: number })[] = [];
    const score = (text: string): number => {
      const t = text.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 60;
      if (t.includes(q)) return 30;
      return 0;
    };

    const byTeam = new Map(teams.map((t) => [t.id, t.name]));
    for (const p of await this.playersOrEmpty()) {
      const s = Math.max(score(p.name), score(p.role) / 2);
      if (s > 0) {
        results.push({
          kind: "player",
          id: p.id,
          title: p.name,
          subtitle: `${p.role} · ${byTeam.get(p.teamId) ?? ""}`,
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

    const { data: teams } = await this.catalogTeams();
    const out: SearchResultDto[] = [];
    // word-prefix matching: "art" hits "Mikel Arteta", "united" hits "Manchester United"
    const starts = (t: string) => {
      const lower = t.toLowerCase();
      return lower.startsWith(q) || lower.split(/\s+/).some((w) => w.startsWith(q));
    };

    for (const p of await this.playersOrEmpty()) if (starts(p.name)) out.push({ kind: "player", id: p.id, title: p.name, subtitle: p.position });
    for (const t of teams) {
      if (starts(t.name) || starts(t.tla)) out.push({ kind: "team", id: t.id, title: t.name, subtitle: t.league });
      if (t.manager !== "—" && starts(t.manager)) out.push({ kind: "manager", id: t.id, title: t.manager, subtitle: t.name });
    }

    const top = out.slice(0, 8);
    await this.cache.set(cacheKey, top, 1800);
    return top;
  }
}
