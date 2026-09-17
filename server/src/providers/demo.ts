import * as demo from "../data/demo";
import type {
  FootballDataProvider,
  NormalizedCompetition,
  NormalizedMatch,
  NormalizedTeam,
  NormalizedTeamStanding,
} from "./types";

/**
 * Demo provider — the bundled dataset expressed through the provider
 * contract. Always available; lets the whole pipeline (sync, merge, snapshot,
 * serve) be exercised end-to-end with zero network and zero keys, and is the
 * permanent last rung of the fallback ladder.
 */
export class DemoProvider implements FootballDataProvider {
  readonly name = "demo";

  available(): boolean {
    return true;
  }

  async fetchStandings(): Promise<NormalizedTeamStanding[]> {
    return demo.leagueTable.map((t) => ({
      extId: `demo-${t.id}`,
      name: t.name,
      competition: t.league,
      tla: t.tla,
      shortName: t.short,
      venue: t.stadium,
      coach: t.manager,
      position: t.position,
      played: t.played,
      won: t.won,
      drawn: t.drawn,
      lost: t.lost,
      gf: t.gf,
      ga: t.ga,
      points: t.points,
      form: t.form,
    }));
  }

  async fetchTeams(): Promise<NormalizedTeam[]> {
    return demo.teams.map((t) => ({
      extId: `demo-${t.id}`,
      name: t.name,
      shortName: t.short,
      tla: t.tla,
      venue: t.stadium,
      coach: t.manager,
      competition: t.league,
    }));
  }

  async fetchCompetitions(): Promise<NormalizedCompetition[]> {
    return [...new Set(demo.teams.map((t) => t.league))].map((name) => ({
      code: name.slice(0, 3).toUpperCase(),
      extId: `demo-${name.toLowerCase().replace(/\W+/g, "-")}`,
      name,
      type: "LEAGUE",
      currentSeason: undefined,
    }));
  }

  async fetchMatches(): Promise<NormalizedMatch[]> {
    return demo.matches.map((m) => ({
      extId: `demo-${m.id}`,
      homeExtId: `demo-${m.homeId}`,
      awayExtId: `demo-${m.awayId}`,
      homeName: demo.teamById.get(m.homeId)?.name ?? m.homeId,
      awayName: demo.teamById.get(m.awayId)?.name ?? m.awayId,
      competition: m.competition,
      status: m.status as NormalizedMatch["status"], // bundled data never holds "unconfirmed" — that is a merge-time verdict
      kickoffIso: m.kickoffIso,
      minute: m.minute,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      venue: m.venue,
    }));
  }
}

/** Test double — hand it exactly the slices a test needs. */
export class MockProvider implements FootballDataProvider {
  readonly name = "mock";
  public calls = { standings: 0, matches: 0 };

  constructor(
    private fixtures: { standings?: NormalizedTeamStanding[]; matches?: NormalizedMatch[]; fail?: boolean } = {},
  ) {}

  available(): boolean {
    return true;
  }

  async fetchStandings(): Promise<NormalizedTeamStanding[]> {
    this.calls.standings++;
    if (this.fixtures.fail) throw new Error("mock provider forced failure");
    return this.fixtures.standings ?? [];
  }

  async fetchMatches(): Promise<NormalizedMatch[]> {
    this.calls.matches++;
    if (this.fixtures.fail) throw new Error("mock provider forced failure");
    return this.fixtures.matches ?? [];
  }
}
