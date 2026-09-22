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

export type NormalizedMatchStatus = "live" | "upcoming" | "finished" | "postponed" | "cancelled";

export interface NormalizedMatch {
  extId: string;
  /**
   * Provider team ids, same namespace as NormalizedTeamStanding.extId. These
   * are how fixtures resolve to teams — names are a fallback only. A club's
   * name varies by source and season ("FC Bayern München" vs "Bayern Munich"),
   * and standings can lag a season behind fixtures, so name matching silently
   * drops real matches.
   */
  homeExtId: string;
  awayExtId: string;
  homeName: string;
  awayName: string;
  /** Provider crest/short name when the fixture payload carries them — lets a
   * fixture introduce a club the standings have not heard of yet. */
  homeTla?: string;
  awayTla?: string;
  homeCrestUrl?: string;
  awayCrestUrl?: string;
  competition: string;
  status: NormalizedMatchStatus;
  /**
   * Half-time. Still `status: "live"` — the match is in progress — but the
   * clock isn't running, so the UI must not show a ticking minute.
   */
  halfTime?: boolean;
  /** ISO 8601 UTC kickoff. */
  kickoffIso: string;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
}

/**
 * A club as the provider knows it — identity and metadata, no table position.
 * Standings carry the numbers; this carries who the club actually is.
 */
export interface NormalizedTeam {
  extId: string;
  name: string;
  shortName?: string;
  tla?: string;
  crestUrl?: string;
  venue?: string;
  founded?: number;
  coach?: string;
  /** Provider's free-text club colours, e.g. "Red / White". Parsing is the merge's job. */
  clubColors?: string;
  website?: string;
  /** Competition this club was fetched under. */
  competition: string;
  /** Registered squad, when the provider supplies one. */
  squad?: { name: string; position?: string; dateOfBirth?: string; nationality?: string }[];
}

/** A competition and where it currently is in its season. */
export interface NormalizedCompetition {
  /** Provider code, e.g. "PL". */
  code: string;
  extId: string;
  name: string;
  /** "LEAGUE" | "CUP" — provider's own vocabulary, passed through. */
  type?: string;
  emblemUrl?: string;
  area?: string;
  currentSeason?: {
    startDateIso: string;
    endDateIso: string;
    /** Null before a ball is kicked — a season that hasn't started has no matchday. */
    currentMatchday: number | null;
  };
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

/**
 * The primary source: identity, fixtures, tables, competitions.
 *
 * Every fetcher is optional — providers are partial by design and implement
 * only what their source (and plan) actually serves.
 */
export interface FootballDataProvider {
  readonly name: string;
  /** Configured and usable (has its API key etc.) — checked before every sync. */
  available(): boolean;
  /** League table for the configured competitions. */
  fetchStandings?(): Promise<NormalizedTeamStanding[]>;
  /** Matches in a window around now (provider decides the exact window). */
  fetchMatches?(): Promise<NormalizedMatch[]>;
  /** Club identity/metadata for the configured competitions. */
  fetchTeams?(): Promise<NormalizedTeam[]>;
  /** Configured competitions and their current season state. */
  fetchCompetitions?(): Promise<NormalizedCompetition[]>;
}

/* ------------------------------------------------------------------------- *
 * Per-match depth: statistics, lineups, events.
 *
 * Deliberately a SEPARATE interface from FootballDataProvider, because these
 * come from a different source than fixtures and tables. football-data.org's
 * free tier serves no match statistics, lineups or events at all, so this
 * contract exists to be implemented by a secondary provider.
 *
 * NOTHING IMPLEMENTS THIS YET, and that is intentional. API-Football is the
 * intended implementor, but its free plan grants seasons 2022–2024 only —
 * verbatim: "Free plans do not have access to this season, try from 2022 to
 * 2024." FootIQ syncs a window in the current season, so a free key returns
 * zero overlap with any fixture we display. Wiring it now would ship a
 * provider that cannot answer for a single match on screen.
 *
 * The interface is defined so the shape is settled and the merge/route work is
 * a known quantity once a plan can feed it. Implement `ApiFootballMatchDepth`
 * against these types when the key is upgraded; the DTOs in shared/contracts
 * are already the frontend-facing shape.
 * ------------------------------------------------------------------------- */

export interface NormalizedMatchStatistics {
  /** Provider's fixture id — the caller resolves ours to theirs. */
  extFixtureId: string;
  home: NormalizedSideStatistics;
  away: NormalizedSideStatistics;
}

export interface NormalizedSideStatistics {
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  /** Only when the source actually computes it — never derived here. */
  expectedGoals?: number;
  corners?: number;
  fouls?: number;
  offsides?: number;
  passes?: number;
  passAccuracy?: number;
  saves?: number;
}

export type NormalizedEventType =
  | "goal"
  | "own-goal"
  | "penalty"
  | "penalty-missed"
  | "assist"
  | "yellow"
  | "red"
  | "sub"
  | "var"
  | "kickoff"
  | "half"
  | "full";

export interface NormalizedMatchEvent {
  minute: number;
  /** Added time on top of `minute`, when the source distinguishes it. */
  extraMinute?: number;
  type: NormalizedEventType;
  /** Provider team id (extId namespace). Absent for match-level events. */
  teamExtId?: string;
  player?: string;
  assist?: string;
  detail?: string;
}

export interface NormalizedLineupPlayer {
  name: string;
  number?: number;
  /** Provider's grid position, e.g. "4:2" — absent for substitutes. */
  grid?: string;
  position?: string;
  captain?: boolean;
}

export interface NormalizedLineup {
  teamExtId: string;
  formation?: string;
  coach?: string;
  startXI: NormalizedLineupPlayer[];
  substitutes: NormalizedLineupPlayer[];
}

/** Secondary provider contract for per-match depth. See the block comment above. */
export interface MatchDepthProvider {
  readonly name: string;
  available(): boolean;
  /** Map one of OUR fixtures to this provider's fixture id — sources don't share ids. */
  resolveFixtureId(match: Pick<NormalizedMatch, "kickoffIso" | "homeName" | "awayName">): Promise<string | null>;
  fetchStatistics(extFixtureId: string): Promise<NormalizedMatchStatistics | null>;
  fetchEvents(extFixtureId: string): Promise<NormalizedMatchEvent[]>;
  fetchLineups(extFixtureId: string): Promise<NormalizedLineup[]>;
}
