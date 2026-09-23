export type Position = "GK" | "DF" | "MF" | "FW";

/** Premier League season totals, as published by the Fantasy Premier League API. */
export interface SeasonStats {
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  cleanSheets: number;
  goalsConceded: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  tackles: number;
  recoveries: number;
  /** Clearances, blocks and interceptions. */
  cbi: number;
  bonus: number;
}

/** FPL's availability flag. Players who left the club ("u") are not synced. */
export type Availability = "available" | "doubtful" | "injured" | "suspended" | "ineligible";

/** FPL's own numbers. `expectedPoints` is FPL's projection — a model output, not a fact. */
export interface FantasyNumbers {
  price: number; // £m
  totalPoints: number;
  form: number;
  pointsPerGame: number;
  selectedBy: number; // % of FPL managers
  expectedPoints: number;
  transfersIn: number; // this gameweek
  transfersOut: number;
}

/**
 * A real Premier League player, synced from the Fantasy Premier League API.
 * Nothing here is invented: ratings, wages, bios and style notes were demo
 * fiction and no free source publishes them, so they no longer exist.
 */
export interface Player {
  /** `fpl-<code>` — FPL's `code` (the Opta id) is stable across seasons; its `id` is not. */
  id: string;
  name: string;
  teamId: string;
  position: Position;
  /** "Goalkeeper" / "Defender" / "Midfielder" / "Forward". */
  role: string;
  age: number | null;
  photoUrl: string;
  availability: Availability;
  /** FPL's injury/suspension note, verbatim; "" when fit. */
  news: string;
  /** Chance of playing next round, %; null when FPL has no doubt flagged. */
  chanceOfPlaying: number | null;
  stats: SeasonStats;
  fantasy: FantasyNumbers;
}

export interface TacticalStyle {
  formation: string;
  buildUp: string;
  press: string;
  line: string;
  tempo: number;
  width: number;
  directness: number;
  pressIntensity: number;
}

export interface Team {
  id: string;
  /**
   * Provider's id for this club when it came from (or was matched to) a sync.
   * Fixtures resolve to teams through this, not through names — a club's name
   * differs between our dataset and the provider's ("Bayern Munich" vs "FC
   * Bayern München"), and matching on names silently dropped those fixtures.
   */
  extId?: string;
  name: string;
  short: string;
  tla: string;
  colors: [string, string];
  stadium: string;
  manager: string;
  league: string;
  /**
   * Real club badge from the provider. Absent for demo-only clubs, where the
   * Crest component falls back to its generated mark.
   */
  crestUrl?: string;
  /** Year founded, when the provider supplies it. */
  founded?: number;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  form: string;
  chemistry: number;
  style: TacticalStyle;
  styleTags: string[];
  aiReport: string[];
  trophies: { name: string; count: number }[];
  /**
   * Real registered squad from the provider (football-data.org free tier: name,
   * position, birth date, nationality — no numbers or stats). Only served by
   * /api/teams/:id; list endpoints strip it to keep every page's payload small.
   */
  squad?: SquadMember[];
}

export interface SquadMember {
  name: string;
  /** Provider vocabulary: "Goalkeeper" | "Defence" | "Midfield" | "Offence", or finer roles. */
  position?: string;
  dateOfBirth?: string;
  nationality?: string;
}

/**
 * "unconfirmed": the provider still says in play, but kickoff was too long ago
 * for that to be true. The result is unknown, so it is neither live nor finished.
 */
export type MatchStatus = "live" | "upcoming" | "finished" | "postponed" | "cancelled" | "unconfirmed";

export interface MatchEvent {
  minute: number;
  type: "goal" | "own-goal" | "penalty" | "yellow" | "red" | "sub" | "chance" | "var" | "kickoff" | "half" | "full";
  teamId?: string;
  player?: string;
  detail: string;
}

export interface SideStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  xG: number;
  passes: number;
  passAccuracy: number;
  corners: number;
  fouls: number;
  bigChances: number;
  tackles: number;
  saves: number;
}

export interface LineupPlayer {
  playerId?: string;
  name: string;
  shirt: number;
  pos: Position;
  x: number; // 0-100 across pitch width
  y: number; // 0-100 from own goal line
  rating: number;
}

export interface Match {
  id: string;
  homeId: string;
  awayId: string;
  competition: string;
  status: MatchStatus;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  /**
   * ISO 8601 UTC kickoff — the only time representation that crosses the wire.
   * Render it with the helpers in lib/kickoff.ts so it lands in the reader's
   * timezone; never store or ship a pre-formatted string.
   */
  kickoffIso: string;
  venue: string;
  headline?: string;
}

export interface MatchDetail extends Match {
  events: MatchEvent[];
  home: SideStats;
  away: SideStats;
  momentum: number[]; // -1 (away) .. 1 (home), one point per ~5 minutes
  homeLineup: { formation: string; players: LineupPlayer[] };
  awayLineup: { formation: string; players: LineupPlayer[] };
  aiCommentary: { minute: number; text: string; kind: "insight" | "event" | "tactical" }[];
  tacticalNote: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: "Transfers" | "Match Report" | "Injury" | "Tactics" | "Interview" | "Rumour";
  minutesAgo: number;
  source: string;
  reliability: number; // 1-5
  aiSummary: string[];
  readSeconds: number;
  body: string[];
  tags: string[];
  teamIds: string[];
  playerIds: string[];
  related: string[];
  updates: { time: string; note: string }[];
}

export interface Prediction {
  matchId: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHome: number;
  expectedAway: number;
  topScores: { score: string; p: number }[];
  over25: number;
  btts: number;
  reasoning: string[];
}

export interface HistoricalMoment {
  id: string;
  year: number;
  kind: "match" | "milestone" | "rivalry" | "moment";
  title: string;
  subtitle: string;
  detail: string;
  tags: string[];
  stat: { label: string; value: string };
}

/** Real FPL gameweek state plus FPL's own fixture difficulty ratings (1 easy – 5 hard). */
export interface FantasyBoard {
  gameweek: {
    number: number;
    deadlineIso: string;
    averageScore: number | null;
    highestScore: number | null;
  };
  fixtureDifficulty: {
    teamId: string;
    fixtures: { gameweek: number; opponentId: string; home: boolean; difficulty: number }[];
  }[];
}
