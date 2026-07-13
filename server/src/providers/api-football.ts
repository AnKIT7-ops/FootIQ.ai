import { z } from "zod";
import type { FootballDataProvider, NormalizedMatch, NormalizedTeamStanding } from "./types";
import { ProviderError } from "./types";

/**
 * API-Football (api-sports.io v3; free tier: 100 req/day). Same contract as
 * football-data.org — standings + fixtures for one league/season.
 */

const RAW_STANDINGS = z.object({
  response: z.array(
    z.object({
      league: z.object({
        standings: z.array(
          z.array(
            z.object({
              rank: z.number(),
              team: z.object({ id: z.number(), name: z.string(), logo: z.string().nullish() }),
              points: z.number(),
              all: z.object({
                played: z.number(),
                win: z.number(),
                draw: z.number(),
                lose: z.number(),
                goals: z.object({ for: z.number(), against: z.number() }),
              }),
              form: z.string().nullish(),
            }),
          ),
        ),
      }),
    }),
  ),
});

const RAW_FIXTURES = z.object({
  response: z.array(
    z.object({
      fixture: z.object({
        id: z.number(),
        date: z.string(),
        status: z.object({ short: z.string(), elapsed: z.number().nullish() }),
        venue: z.object({ name: z.string().nullish() }).nullish(),
      }),
      league: z.object({ name: z.string() }),
      teams: z.object({
        home: z.object({ name: z.string() }),
        away: z.object({ name: z.string() }),
      }),
      goals: z.object({ home: z.number().nullish(), away: z.number().nullish() }),
    }),
  ),
});

const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
const FINISHED = new Set(["FT", "AET", "PEN"]);

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = "api-football";

  constructor(
    private apiKey: string | undefined,
    /** League id (39 = Premier League) and season start year. */
    private league: number,
    private season: number,
    // wrapped: calling a stored bare `fetch` as `this.fetchImpl()` rebinds `this`
    // to the provider — Workers rejects that with "Illegal invocation"
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  available(): boolean {
    return Boolean(this.apiKey);
  }

  private async get(path: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(`https://v3.football.api-sports.io${path}`, {
        headers: { "x-apisports-key": this.apiKey! },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new ProviderError(this.name, `network failure: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (!res.ok) throw new ProviderError(this.name, `HTTP ${res.status} on ${path}`, res.status);
    return res.json();
  }

  async fetchStandings(): Promise<NormalizedTeamStanding[]> {
    const raw = RAW_STANDINGS.safeParse(await this.get(`/standings?league=${this.league}&season=${this.season}`));
    if (!raw.success) throw new ProviderError(this.name, `standings schema drift: ${raw.error.issues[0]?.message}`);
    const table = raw.data.response[0]?.league.standings[0] ?? [];
    return table.map((row) => ({
      extId: `af-${row.team.id}`,
      name: row.team.name,
      crestUrl: row.team.logo ?? undefined,
      position: row.rank,
      played: row.all.played,
      won: row.all.win,
      drawn: row.all.draw,
      lost: row.all.lose,
      gf: row.all.goals.for,
      ga: row.all.goals.against,
      points: row.points,
      form: row.form ?? undefined,
    }));
  }

  async fetchMatches(): Promise<NormalizedMatch[]> {
    const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const raw = RAW_FIXTURES.safeParse(
      await this.get(`/fixtures?league=${this.league}&season=${this.season}&from=${from}&to=${to}`),
    );
    if (!raw.success) throw new ProviderError(this.name, `fixtures schema drift: ${raw.error.issues[0]?.message}`);
    return raw.data.response.map((r) => ({
      extId: `af-${r.fixture.id}`,
      homeName: r.teams.home.name,
      awayName: r.teams.away.name,
      competition: r.league.name,
      status: LIVE.has(r.fixture.status.short) ? "live" : FINISHED.has(r.fixture.status.short) ? "finished" : "upcoming",
      kickoffIso: r.fixture.date,
      minute: r.fixture.status.elapsed ?? undefined,
      homeScore: r.goals.home ?? undefined,
      awayScore: r.goals.away ?? undefined,
      venue: r.fixture.venue?.name ?? undefined,
    }));
  }
}
