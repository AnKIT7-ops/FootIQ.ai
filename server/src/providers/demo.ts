import * as demo from "../data/demo";
import type { FootballDataProvider, NormalizedMatch, NormalizedTeamStanding } from "./types";

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

  async fetchMatches(): Promise<NormalizedMatch[]> {
    return demo.matches.map((m) => ({
      extId: `demo-${m.id}`,
      homeName: demo.teamById.get(m.homeId)?.name ?? m.homeId,
      awayName: demo.teamById.get(m.awayId)?.name ?? m.awayId,
      competition: m.competition,
      status: m.status,
      kickoffIso: m.kickoff,
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
