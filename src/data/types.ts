export type Position = "GK" | "DF" | "MF" | "FW";

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  pressing: number;
  vision: number;
}

export interface SeasonStats {
  apps: number;
  minutes: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  keyPasses: number;
  passAccuracy: number;
  dribblesPerGame: number;
  tacklesPerGame: number;
  interceptionsPerGame: number;
  aerialsWonPerGame: number;
  rating: number;
}

export interface InjuryRecord {
  injury: string;
  date: string;
  daysOut: number;
  gamesMissed: number;
}

export interface TransferRecord {
  season: string;
  from: string;
  to: string;
  fee: number | "free" | "loan" | "academy";
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: Position;
  role: string;
  age: number;
  nationality: string;
  flag: string;
  heightCm: number;
  foot: "Left" | "Right" | "Both";
  shirt: number;
  marketValue: number;
  weeklyWage: number;
  contractUntil: number;
  attributes: PlayerAttributes;
  stats: SeasonStats;
  form: number[];
  injuryHistory: InjuryRecord[];
  transferHistory: TransferRecord[];
  strengths: string[];
  weaknesses: string[];
  style: string;
  bio: string;
  similar: string[];
  starter: boolean;
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

export interface TransferRumor {
  id: string;
  playerId: string;
  fromId: string;
  toId: string;
  fee: number;
  wages: number;
  probability: number;
  reliability: number;
  stage: string;
  trend: "rising" | "cooling" | "stable";
  timeline: { date: string; event: string }[];
  finances: { label: string; value: string }[];
  replacements: string[];
  sentiment: { positive: number; sample: { handle: string; text: string; mood: "for" | "against" }[] };
  aiNote: string;
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
  mvp: { playerId: string; p: number }[];
  reasoning: string[];
}

export interface Clip {
  id: string;
  title: string;
  type: "goal" | "assist" | "save" | "skill" | "tackle" | "moment";
  playerId?: string;
  teamId: string;
  seconds: number;
  views: string;
  likes: string;
  caption: string;
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

export interface FantasyPick {
  playerId: string;
  expectedPoints: number;
  ownership: number;
  fixtureEase: number; // 1 hard - 5 easy
  note: string;
}
