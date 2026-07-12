import { z } from "zod";
import type { FootballDataProvider, NormalizedMatch, NormalizedTeamStanding } from "./types";
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
      homeTeam: z.object({ name: z.string().nullish() }),
      awayTeam: z.object({ name: z.string().nullish() }),
      score: z.object({
        fullTime: z.object({ home: z.number().nullish(), away: z.number().nullish() }),
      }),
      venue: z.string().nullish(),
    }),
  ),
});

const statusMap = (s: string): NormalizedMatch["status"] =>
  s === "IN_PLAY" || s === "PAUSED" ? "live" : s === "FINISHED" ? "finished" : "upcoming";

export class FootballDataOrgProvider implements FootballDataProvider {
  readonly name = "football-data.org";

  constructor(
    private apiKey: string | undefined,
    /** Competition code, e.g. "PL". */
    private competition: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  available(): boolean {
    return Boolean(this.apiKey);
  }

  private async get(path: string): Promise<unknown> {
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

  async fetchStandings(): Promise<NormalizedTeamStanding[]> {
    const raw = RAW_STANDINGS.safeParse(await this.get(`/competitions/${this.competition}/standings`));
    if (!raw.success) throw new ProviderError(this.name, `standings schema drift: ${raw.error.issues[0]?.message}`);
    const table = raw.data.standings.find((s) => s.type === "TOTAL")?.table ?? [];
    return table.map((row) => ({
      extId: `fd-${row.team.id}`,
      name: row.team.name,
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
  }

  async fetchMatches(): Promise<NormalizedMatch[]> {
    const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const raw = RAW_MATCHES.safeParse(
      await this.get(`/competitions/${this.competition}/matches?dateFrom=${from}&dateTo=${to}`),
    );
    if (!raw.success) throw new ProviderError(this.name, `matches schema drift: ${raw.error.issues[0]?.message}`);
    return raw.data.matches
      .filter((m) => m.homeTeam.name && m.awayTeam.name)
      .map((m) => ({
        extId: `fd-${m.id}`,
        homeName: m.homeTeam.name!,
        awayName: m.awayTeam.name!,
        competition: m.competition?.name ?? this.competition,
        status: statusMap(m.status),
        kickoffIso: m.utcDate,
        minute: m.minute ?? undefined,
        homeScore: m.score.fullTime.home ?? undefined,
        awayScore: m.score.fullTime.away ?? undefined,
        venue: m.venue ?? undefined,
      }));
  }
}
