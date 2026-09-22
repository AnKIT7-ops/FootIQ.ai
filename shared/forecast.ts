/**
 * Match forecast from the league table — an independent-Poisson goals model.
 *
 * Every input is a measured fact (goals for/against and games played from the
 * synced standings); every output is a model inference and must render amber.
 * Shared so the web app and the API compute the same numbers.
 *
 *   attack  = team goals scored per game  / league goals per team-game
 *   defence = team goals conceded per game / league goals per team-game
 *   λ_home  = league avg × attack_home × defence_away × HOME_EDGE
 *   λ_away  = league avg × attack_away × defence_home ÷ HOME_EDGE
 *
 * ponytail: independent Poisson with a flat home edge; underrates draws a
 * little and knows nothing of injuries, schedule or xG. Upgrade path:
 * Dixon–Coles low-score correction, then xG-based ratings once a stats
 * provider exists.
 */

export interface TableRecord {
  played: number;
  gf: number;
  ga: number;
}

export interface Forecast {
  /** Percent, sum to 100. */
  homeWin: number;
  draw: number;
  awayWin: number;
  /** Expected goals (model), one decimal. */
  expectedHome: number;
  expectedAway: number;
  /** Percent. */
  over25: number;
  btts: number;
  topScores: { score: string; p: number }[];
  /** The facts the forecast was built from — shown beside it, never hidden. */
  basis: {
    leagueGoalsPerTeamGame: number;
    home: { played: number; scoredPerGame: number; concededPerGame: number };
    away: { played: number; scoredPerGame: number; concededPerGame: number };
  };
}

/** Home sides score ~12% more and concede ~11% less across Europe's top leagues. */
export const HOME_EDGE = 1.12;
/**
 * Pseudo-games of league-average form blended into every record. Four games
 * into a season a 4-0 win is a quarter of the sample; this keeps one result
 * from making a side look like champions or relegation fodder.
 */
export const PRIOR_GAMES = 5;
const MAX_GOALS = 10;

/** Goals per team per game across a league — the model's baseline. Null when nothing has been played. */
export function leagueBaseline(records: TableRecord[]): number | null {
  const played = records.reduce((s, r) => s + r.played, 0);
  if (played === 0) return null;
  return records.reduce((s, r) => s + r.gf, 0) / played;
}

function poisson(k: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/** Round a set of shares to integers that sum to exactly 100 (largest remainder). */
function toPercents(values: number[]): number[] {
  const raw = values.map((v) => v * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

export function forecastMatch(home: TableRecord, away: TableRecord, baseline: number): Forecast {
  const shrunk = (goals: number, played: number) => (goals + PRIOR_GAMES * baseline) / (played + PRIOR_GAMES);
  const attackH = shrunk(home.gf, home.played) / baseline;
  const defenceH = shrunk(home.ga, home.played) / baseline;
  const attackA = shrunk(away.gf, away.played) / baseline;
  const defenceA = shrunk(away.ga, away.played) / baseline;

  const lh = baseline * attackH * defenceA * HOME_EDGE;
  const la = (baseline * attackA * defenceH) / HOME_EDGE;

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver = 0;
  let pBtts = 0;
  const scores: { score: string; p: number }[] = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    const ph = poisson(h, lh);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph * poisson(a, la);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (h + a > 2) pOver += p;
      if (h > 0 && a > 0) pBtts += p;
      scores.push({ score: `${h}-${a}`, p });
    }
  }
  // The grid truncates at 10 goals; renormalise so the three outcomes are a full distribution.
  const total = pHome + pDraw + pAway;
  const [homeWin, draw, awayWin] = toPercents([pHome / total, pDraw / total, pAway / total]);

  const perGame = (goals: number, played: number) => (played > 0 ? Math.round((goals / played) * 100) / 100 : 0);
  return {
    homeWin,
    draw,
    awayWin,
    expectedHome: Math.round(lh * 10) / 10,
    expectedAway: Math.round(la * 10) / 10,
    over25: Math.round((pOver / total) * 100),
    btts: Math.round((pBtts / total) * 100),
    topScores: scores
      .sort((a, b) => b.p - a.p)
      .slice(0, 5)
      .map((s) => ({ score: s.score, p: Math.round((s.p / total) * 100) })),
    basis: {
      leagueGoalsPerTeamGame: Math.round(baseline * 100) / 100,
      home: { played: home.played, scoredPerGame: perGame(home.gf, home.played), concededPerGame: perGame(home.ga, home.played) },
      away: { played: away.played, scoredPerGame: perGame(away.gf, away.played), concededPerGame: perGame(away.ga, away.played) },
    },
  };
}

export type FixtureForecast<T> =
  | { ok: true; forecast: Forecast; home: T; away: T }
  /** Why there's no number — shown to the reader instead of a made-up one. */
  | { ok: false; reason: string };

/**
 * Forecast one fixture from the synced league tables.
 *
 * Only domestic-league fixtures qualify: both clubs must be filed under the
 * fixture's competition. A Champions League tie pits two leagues' tables
 * against each other, and goals-per-game in one league says nothing
 * calibrated about the other — those get an honest "no forecast".
 */
export function forecastFixture<T extends TableRecord & { id: string; league: string }>(
  match: { homeId: string; awayId: string; competition: string },
  teams: T[],
): FixtureForecast<T> {
  const home = teams.find((t) => t.id === match.homeId);
  const away = teams.find((t) => t.id === match.awayId);
  if (!home || !away) return { ok: false, reason: "One of these clubs isn't in the synced tables yet." };
  if (home.league !== match.competition || away.league !== match.competition) {
    return { ok: false, reason: "Cross-league fixture — domestic tables aren't comparable, so the model doesn't price it." };
  }
  const baseline = leagueBaseline(teams.filter((t) => t.league === match.competition));
  if (baseline === null) return { ok: false, reason: "No games played in this league yet — nothing to model from." };
  return { ok: true, forecast: forecastMatch(home, away, baseline), home, away };
}
