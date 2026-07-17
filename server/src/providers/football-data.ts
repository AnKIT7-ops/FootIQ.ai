import { z } from "zod";
import type {
  FootballDataProvider,
  NormalizedCompetition,
  NormalizedMatch,
  NormalizedTeam,
  NormalizedTeamStanding,
} from "./types";
import { ProviderError } from "./types";

/**
 * football-data.org v4 (free tier: 10 req/min, top competitions, standings +
 * fixtures + results). Attribution required on the site per their terms:
 * "Football data provided by the Football-Data.org API".
 *
 * Fetch → validate (zod on the raw payload — a vendor schema drift fails the
 * sync loudly instead of writing garbage) → normalize. No persistence here.
 */

const RAW_STANDINGS = z.object({
  // A label, not a number — a missing one must not fail an otherwise good sync.
  competition: z.object({ name: z.string() }).nullish(),
  standings: z.array(
    z.object({
      type: z.string(),
      table: z.array(
        z.object({
          position: z.number(),
          team: z.object({
            id: z.number(),
            name: z.string(),
            shortName: z.string().nullish(),
            tla: z.string().nullish(),
            crest: z.string().nullish(),
          }),
          playedGames: z.number(),
          won: z.number(),
          draw: z.number(),
          lost: z.number(),
          points: z.number(),
          goalsFor: z.number(),
          goalsAgainst: z.number(),
          form: z.string().nullish(),
        }),
      ),
    }),
  ),
});

const RAW_MATCHES = z.object({
  matches: z.array(
    z.object({
      id: z.number(),
      utcDate: z.string(),
      status: z.string(), // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
      minute: z.number().nullish(),
      competition: z.object({ name: z.string() }).optional(),
      homeTeam: z.object({
        id: z.number().nullish(),
        name: z.string().nullish(),
        tla: z.string().nullish(),
        crest: z.string().nullish(),
      }),
      awayTeam: z.object({
        id: z.number().nullish(),
        name: z.string().nullish(),
        tla: z.string().nullish(),
        crest: z.string().nullish(),
      }),
      score: z.object({
        fullTime: z.object({ home: z.number().nullish(), away: z.number().nullish() }),
      }),
      venue: z.string().nullish(),
    }),
  ),
});

const RAW_TEAMS = z.object({
  // The competition's display name. Without it, clubs introduced by this
  // endpoint were filed under the CODE ("PD") while standings filed the same
  // competition under its NAME ("Primera Division") — the league picker showed
  // both, as if they were different competitions.
  competition: z.object({ name: z.string() }).nullish(),
  teams: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      shortName: z.string().nullish(),
      tla: z.string().nullish(),
      crest: z.string().nullish(),
      website: z.string().nullish(),
      founded: z.number().nullish(),
      clubColors: z.string().nullish(),
      venue: z.string().nullish(),
      // Present in the schema but unpopulated on the free tier (0/20 clubs).
      coach: z.object({ name: z.string().nullish() }).nullish(),
    }),
  ),
});

const RAW_COMPETITIONS = z.object({
  competitions: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      code: z.string(),
      type: z.string().nullish(),
      emblem: z.string().nullish(),
      area: z.object({ name: z.string().nullish() }).nullish(),
      currentSeason: z
        .object({
          startDate: z.string().nullish(),
          endDate: z.string().nullish(),
          currentMatchday: z.number().nullish(),
        })
        .nullish(),
    }),
  ),
});

/**
 * v4 statuses: SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED |
 * SUSPENDED | CANCELLED | AWARDED. Anything unrecognized falls to "upcoming"
 * — a fixture we can't classify is still a fixture, never a live match.
 *
 * PAUSED is half-time: still a live match, and the UI distinguishes it via
 * `half` rather than by inventing a minute that isn't ticking.
 */
const statusMap = (s: string): NormalizedMatch["status"] => {
  switch (s) {
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "upcoming";
  }
};

/** Free tier: 10 requests/minute. Stay under it with margin — a 429 costs the whole sync. */
const MIN_REQUEST_SPACING_MS = 7_000;

export class FootballDataOrgProvider implements FootballDataProvider {
  readonly name = "football-data.org";
  private lastRequestAt = 0;

  constructor(
    private apiKey: string | undefined,
    /** Competition codes, synced in order, e.g. ["PL", "PD"]. */
    private competitions: string[],
    /** Ingest window in days, past and future. */
    private window: { pastDays: number; futureDays: number },
    // wrapped: calling a stored bare `fetch` as `this.fetchImpl()` rebinds `this`
    // to the provider — Workers rejects that with "Illegal invocation"
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  available(): boolean {
    return Boolean(this.apiKey) && this.competitions.length > 0;
  }

  /** Serialize requests with spacing — the free tier's 10/min is per key, not per competition. */
  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + MIN_REQUEST_SPACING_MS - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private async get(path: string): Promise<unknown> {
    await this.throttle();
    let res: Response;
    try {
      res = await this.fetchImpl(`https://api.football-data.org/v4${path}`, {
        headers: { "X-Auth-Token": this.apiKey! },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new ProviderError(this.name, `network failure: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (!res.ok) throw new ProviderError(this.name, `HTTP ${res.status} on ${path}`, res.status);
    return res.json();
  }

  /**
   * Run a fetch per competition, tolerating per-competition failure.
   *
   * One competition 403ing (not on this key's tier) or 404ing must not throw
   * away the five that succeeded — a partial catalog is strictly better than
   * none, and the alternative is one unavailable league silently blanking the
   * whole app. Total failure still throws, so the job registry records it and
   * the last good snapshot stands.
   */
  private async perCompetition<T>(
    kind: string,
    fetchOne: (code: string) => Promise<T[]>,
  ): Promise<T[]> {
    const out: T[] = [];
    const failures: string[] = [];
    for (const code of this.competitions) {
      try {
        out.push(...(await fetchOne(code)));
      } catch (err) {
        failures.push(`${code}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    if (failures.length === this.competitions.length) {
      throw new ProviderError(this.name, `all ${kind} fetches failed — ${failures.join("; ")}`);
    }
    return out;
  }

  async fetchStandings(): Promise<NormalizedTeamStanding[]> {
    return this.perCompetition("standings", async (code) => {
      const raw = RAW_STANDINGS.safeParse(await this.get(`/competitions/${code}/standings`));
      if (!raw.success) throw new ProviderError(this.name, `standings schema drift: ${raw.error.issues[0]?.message}`);
      const table = raw.data.standings.find((s) => s.type === "TOTAL")?.table ?? [];
      return table.map((row) => ({
        extId: `fd-${row.team.id}`,
        name: row.team.name,
        competition: raw.data.competition?.name ?? code,
        tla: row.team.tla ?? undefined,
        shortName: row.team.shortName ?? undefined,
        crestUrl: row.team.crest ?? undefined,
        position: row.position,
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        gf: row.goalsFor,
        ga: row.goalsAgainst,
        points: row.points,
        form: row.form?.replaceAll(",", "") ?? undefined,
      }));
    });
  }

  /** Club identity per competition — one request each, so this is a 24h-TTL sync, not a 30-minute one. */
  async fetchTeams(): Promise<NormalizedTeam[]> {
    return this.perCompetition("teams", async (code) => {
      const raw = RAW_TEAMS.safeParse(await this.get(`/competitions/${code}/teams`));
      if (!raw.success) throw new ProviderError(this.name, `teams schema drift: ${raw.error.issues[0]?.message}`);
      return raw.data.teams.map((t) => ({
        extId: `fd-${t.id}`,
        name: t.name,
        shortName: t.shortName ?? undefined,
        tla: t.tla ?? undefined,
        crestUrl: t.crest ?? undefined,
        venue: t.venue ?? undefined,
        founded: t.founded ?? undefined,
        // Free tier returns coach.name === null for every club. Kept because
        // the field is real and a paid tier populates it — undefined, never "—".
        coach: t.coach?.name ?? undefined,
        clubColors: t.clubColors ?? undefined,
        website: t.website ?? undefined,
        // The NAME, matching what standings report — never the code.
        competition: raw.data.competition?.name ?? code,
      }));
    });
  }

  /**
   * Competitions and their current season state.
   *
   * ONE request for all of them — /competitions returns every competition the
   * key can see, each with its currentSeason. Fetching /competitions/{code} per
   * code would be six requests for the same data.
   */
  async fetchCompetitions(): Promise<NormalizedCompetition[]> {
    const raw = RAW_COMPETITIONS.safeParse(await this.get(`/competitions`));
    if (!raw.success) throw new ProviderError(this.name, `competitions schema drift: ${raw.error.issues[0]?.message}`);
    const wanted = new Set(this.competitions);
    return raw.data.competitions
      .filter((c) => wanted.has(c.code.toUpperCase()))
      .map((c) => {
        const s = c.currentSeason;
        return {
          code: c.code,
          extId: `fd-${c.id}`,
          name: c.name,
          type: c.type ?? undefined,
          emblemUrl: c.emblem ?? undefined,
          area: c.area?.name ?? undefined,
          currentSeason:
            s?.startDate && s.endDate
              ? {
                  startDateIso: s.startDate,
                  endDateIso: s.endDate,
                  // Null before kickoff — a season that hasn't started has no matchday.
                  currentMatchday: s.currentMatchday ?? null,
                }
              : undefined,
        };
      });
  }

  async fetchMatches(): Promise<NormalizedMatch[]> {
    const from = new Date(Date.now() - this.window.pastDays * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + this.window.futureDays * 864e5).toISOString().slice(0, 10);
    return this.perCompetition("matches", async (code) => {
      const raw = RAW_MATCHES.safeParse(await this.get(`/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`));
      if (!raw.success) throw new ProviderError(this.name, `matches schema drift: ${raw.error.issues[0]?.message}`);
      return raw.data.matches
        .filter((m) => m.homeTeam.name && m.awayTeam.name && m.homeTeam.id && m.awayTeam.id)
        .map((m) => ({
          extId: `fd-${m.id}`,
          homeExtId: `fd-${m.homeTeam.id}`,
          awayExtId: `fd-${m.awayTeam.id}`,
          homeName: m.homeTeam.name!,
          awayName: m.awayTeam.name!,
          homeTla: m.homeTeam.tla ?? undefined,
          awayTla: m.awayTeam.tla ?? undefined,
          homeCrestUrl: m.homeTeam.crest ?? undefined,
          awayCrestUrl: m.awayTeam.crest ?? undefined,
          competition: m.competition?.name ?? code,
          status: statusMap(m.status),
          halfTime: m.status === "PAUSED" || undefined,
          kickoffIso: m.utcDate,
          minute: m.minute ?? undefined,
          homeScore: m.score.fullTime.home ?? undefined,
          awayScore: m.score.fullTime.away ?? undefined,
          venue: m.venue ?? undefined,
        }));
    });
  }
}
