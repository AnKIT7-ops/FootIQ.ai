/**
 * Football data provider abstraction.
 *
 * A provider fetches from ONE external source and returns NORMALIZED slices —
 * lean, provider-truth shapes (below). It never returns raw vendor payloads
 * upward and never touches cache/DB; the sync pipeline owns persistence and
 * the merge into the full FootIQ catalog model (jobs/normalize.ts).
 *
 * Providers are partial by design: free tiers expose standings and fixtures,
 * not xG or player attributes. A provider implements only the fetchers its
 * source supports; everything else stays demo/derived. The frontend never
 * knows which provider is active — it sees the same catalog shapes always.
 */

export interface NormalizedTeamStanding {
  /** Provider's id for the team, prefixed by provider name for uniqueness. */
  extId: string;
  name: string;
  /** Competition this table belongs to, e.g. "Premier League". */
  competition: string;
  /** Three-letter code when the source has one. */
  tla?: string;
  shortName?: string;
  crestUrl?: string;
  venue?: string;
  coach?: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  /** Most recent first, e.g. "WWDLW" — providers vary; optional. */
  form?: string;
}

export type NormalizedMatchStatus = "live" | "upcoming" | "finished";

export interface NormalizedMatch {
  extId: string;
  homeName: string;
  awayName: string;
  competition: string;
  status: NormalizedMatchStatus;
  /** ISO 8601 UTC kickoff. */
  kickoffIso: string;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
}

/** Thrown by providers on upstream failure — the pipeline treats it as "skip this sync, keep last snapshot". */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

export interface FootballDataProvider {
  readonly name: string;
  /** Configured and usable (has its API key etc.) — checked before every sync. */
  available(): boolean;
  /** League table for the configured competition. */
  fetchStandings?(): Promise<NormalizedTeamStanding[]>;
  /** Matches in a window around now (provider decides the exact window). */
  fetchMatches?(): Promise<NormalizedMatch[]>;
}
