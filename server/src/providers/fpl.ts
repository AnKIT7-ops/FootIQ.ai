import { z } from "zod";
import type { Availability, FantasyBoard, Player, Position, Team } from "../data/demo";

/**
 * Real Premier League players from the Fantasy Premier League API — free, no
 * key, every registered player with current-season minutes, goals, assists,
 * xG/xA, cards, saves, defensive actions, injury news and FPL's own numbers.
 *
 * It is the Premier League's public game API, not a licensed data feed:
 * fine for a free product, but a commercial launch needs a data agreement
 * (same caveat as football-data.org's free tier — see PHASE_5.md).
 */

const BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/?future=1";
const photoUrl = (code: number) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;

const num = z.coerce.number(); // FPL sends decimals as strings ("1.77")

const RawElement = z.object({
  code: z.number(),
  first_name: z.string(),
  second_name: z.string(),
  team: z.number(),
  element_type: z.number(),
  birth_date: z.string().nullish(),
  status: z.string(),
  news: z.string(),
  chance_of_playing_next_round: z.number().nullable(),
  now_cost: z.number(),
  total_points: z.number(),
  form: num,
  points_per_game: num,
  selected_by_percent: num,
  ep_next: num.nullable(),
  transfers_in_event: z.number(),
  transfers_out_event: z.number(),
  starts: z.number(),
  minutes: z.number(),
  goals_scored: z.number(),
  assists: z.number(),
  expected_goals: num,
  expected_assists: num,
  clean_sheets: z.number(),
  goals_conceded: z.number(),
  saves: z.number(),
  yellow_cards: z.number(),
  red_cards: z.number(),
  tackles: z.number(),
  recoveries: z.number(),
  clearances_blocks_interceptions: z.number(),
  bonus: z.number(),
});

const RawBootstrap = z.object({
  teams: z.array(z.object({ id: z.number(), name: z.string(), short_name: z.string() })),
  events: z.array(
    z.object({
      id: z.number(),
      deadline_time: z.string(),
      is_current: z.boolean(),
      is_next: z.boolean(),
      average_entry_score: z.number().nullable(),
      highest_score: z.number().nullable(),
    }),
  ),
  elements: z.array(z.unknown()).min(1),
});
type RawElementT = z.input<typeof RawElement>;
/** FPL's decimals arrive as strings ("1.77"). */
const n = (v: unknown): number => Number(v) || 0;

const RawFixtures = z.array(
  z.object({
    event: z.number().nullable(),
    team_h: z.number(),
    team_a: z.number(),
    team_h_difficulty: z.number(),
    team_a_difficulty: z.number(),
  }),
);

const POSITION: Record<number, [Position, string]> = {
  1: ["GK", "Goalkeeper"],
  2: ["DF", "Defender"],
  3: ["MF", "Midfielder"],
  4: ["FW", "Forward"],
};

const AVAILABILITY: Record<string, Availability> = {
  a: "available",
  d: "doubtful",
  i: "injured",
  s: "suspended",
  n: "ineligible",
};

/** FPL short names that differ from football-data.org's TLAs. */
const TLA_ALIASES: Record<string, string> = { NFO: "NOT" };

export function ageOn(birthIso: string | null | undefined, now: Date): number | null {
  if (!birthIso) return null;
  const b = new Date(birthIso);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export interface FplSync {
  players: Player[];
  board: FantasyBoard;
  /** FPL clubs we couldn't match to a synced team — their players are skipped. */
  unmatchedClubs: string[];
}

/**
 * Pure normalization — the part worth testing. `teams` are the synced league
 * teams; FPL clubs resolve to them by TLA, never by name.
 */
export function normalizeFpl(bootstrap: unknown, fixtures: unknown, teams: Team[], now = new Date()): FplSync {
  const raw = RawBootstrap.parse(bootstrap);
  const byTla = new Map(
    teams.filter((t) => t.league === "Premier League").map((t) => [t.tla.toUpperCase(), t.id] as const),
  );
  const teamIdFor = new Map<number, string>();
  const unmatchedClubs: string[] = [];
  for (const club of raw.teams) {
    const tla = club.short_name.toUpperCase();
    const id = byTla.get(TLA_ALIASES[tla] ?? tla);
    if (id) teamIdFor.set(club.id, id);
    else unmatchedClubs.push(club.name);
  }

  // Schema-drift check on one element, not all ~700: zod over the full list
  // costs ~10 ms of CPU, which is the entire Workers free-plan budget.
  // ponytail: sample validation; FPL's elements are homogeneous, validate all if that ever stops being true.
  RawElement.parse(raw.elements[0]);
  const players: Player[] = [];
  for (const e of raw.elements as RawElementT[]) {
    const teamId = teamIdFor.get(e.team);
    const position = POSITION[e.element_type];
    const availability = AVAILABILITY[e.status];
    // "u" = left the club / loaned out: not a current Premier League player.
    if (!teamId || !position || !availability) continue;
    players.push({
      id: `fpl-${e.code}`,
      name: `${e.first_name} ${e.second_name}`.trim(),
      teamId,
      position: position[0],
      role: position[1],
      age: ageOn(e.birth_date, now),
      photoUrl: photoUrl(e.code),
      availability,
      news: e.news,
      chanceOfPlaying: e.chance_of_playing_next_round,
      stats: {
        starts: e.starts,
        minutes: e.minutes,
        goals: e.goals_scored,
        assists: e.assists,
        xG: n(e.expected_goals),
        xA: n(e.expected_assists),
        cleanSheets: e.clean_sheets,
        goalsConceded: e.goals_conceded,
        saves: e.saves,
        yellowCards: e.yellow_cards,
        redCards: e.red_cards,
        tackles: e.tackles,
        recoveries: e.recoveries,
        cbi: e.clearances_blocks_interceptions,
        bonus: e.bonus,
      },
      fantasy: {
        price: e.now_cost / 10,
        totalPoints: e.total_points,
        form: n(e.form),
        pointsPerGame: n(e.points_per_game),
        selectedBy: n(e.selected_by_percent),
        expectedPoints: n(e.ep_next),
        transfersIn: e.transfers_in_event,
        transfersOut: e.transfers_out_event,
      },
    });
  }

  // The gameweek people are picking for: the next one once the current deadline has passed.
  const next = raw.events.find((ev) => ev.is_next) ?? raw.events.find((ev) => ev.is_current);
  const current = raw.events.find((ev) => ev.is_current);
  if (!next) throw new Error("FPL returned no current or next gameweek");

  const upcoming = RawFixtures.parse(fixtures).filter((f) => f.event != null && f.event >= next.id && f.event < next.id + 5);
  const fixtureDifficulty: FantasyBoard["fixtureDifficulty"] = [];
  for (const [fplId, teamId] of teamIdFor) {
    const list = upcoming
      .filter((f) => f.team_h === fplId || f.team_a === fplId)
      .map((f) => {
        const home = f.team_h === fplId;
        const opponentId = teamIdFor.get(home ? f.team_a : f.team_h);
        return opponentId
          ? { gameweek: f.event as number, opponentId, home, difficulty: home ? f.team_h_difficulty : f.team_a_difficulty }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.gameweek - b.gameweek);
    fixtureDifficulty.push({ teamId, fixtures: list });
  }

  return {
    players,
    board: {
      gameweek: {
        number: next.id,
        deadlineIso: next.deadline_time,
        // The average/highest belong to the gameweek that has been played, not the one being picked for.
        averageScore: current?.average_entry_score ?? null,
        highestScore: current?.highest_score ?? null,
      },
      fixtureDifficulty,
    },
    unmatchedClubs,
  };
}

export async function fetchFpl(
  teams: Team[],
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<FplSync> {
  const get = async (url: string) => {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "FootIQ/1.0 (+https://footiq-omega.vercel.app)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`FPL ${url} → HTTP ${res.status}`);
    return res.json();
  };
  const [bootstrap, fixtures] = await Promise.all([get(BOOTSTRAP_URL), get(FIXTURES_URL)]);
  return normalizeFpl(bootstrap, fixtures, teams);
}
