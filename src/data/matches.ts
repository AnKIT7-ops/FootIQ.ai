import type { Match, MatchDetail, MatchEvent, SideStats, Team } from "./types";
import { getTeam } from "./teams";
// relative on purpose: the data layer is imported by the API server too
import { hashCode, seeded, clamp } from "../lib/utils";
import { lineupFor, momentumFor } from "./generators";

/**
 * Demo fixture set — reachable ONLY through the server's DemoProvider
 * (DATA_PROVIDER=demo), which serves it through the normal provider contract
 * so it arrives tagged `source: "demo"`. The frontend no longer seeds itself
 * from this list; `lib/repositories/matches.ts` starts empty on purpose.
 *
 * Kickoffs are ISO 8601, computed relative to load time so the demo dataset
 * stays coherent (an "upcoming" match is genuinely in the future) instead of
 * carrying frozen strings like "Sat 15:00" that no code could sort or compare.
 */
const at = (dayOffset: number, hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const matches: Match[] = [
  // live
  { id: "ars-liv", homeId: "ars", awayId: "liv", competition: "Premier League", status: "live", minute: 67, homeScore: 2, awayScore: 1, kickoffIso: at(0, "17:30"), venue: "Emirates Stadium", headline: "Title six-pointer" },
  { id: "bar-rma", homeId: "bar", awayId: "rma", competition: "La Liga", status: "live", minute: 54, homeScore: 1, awayScore: 1, kickoffIso: at(0, "17:00"), venue: "Spotify Camp Nou", headline: "El Clásico" },
  { id: "bay-psg", homeId: "bay", awayId: "psg", competition: "Champions League QF", status: "live", minute: 31, homeScore: 0, awayScore: 1, kickoffIso: at(0, "18:00"), venue: "Allianz Arena", headline: "European heavyweight clash" },
  // upcoming
  { id: "mci-che", homeId: "mci", awayId: "che", competition: "Premier League", status: "upcoming", kickoffIso: at(1, "16:30"), venue: "Etihad Stadium" },
  { id: "tot-mun", homeId: "tot", awayId: "mun", competition: "Premier League", status: "upcoming", kickoffIso: at(1, "14:00"), venue: "Tottenham Hotspur Stadium" },
  { id: "new-avl", homeId: "new", awayId: "avl", competition: "Premier League", status: "upcoming", kickoffIso: at(3, "15:00"), venue: "St James' Park" },
  { id: "liv-mci", homeId: "liv", awayId: "mci", competition: "Premier League", status: "upcoming", kickoffIso: at(4, "16:30"), venue: "Anfield" },
  { id: "rma-psg", homeId: "rma", awayId: "psg", competition: "Champions League QF", status: "upcoming", kickoffIso: at(7, "20:00"), venue: "Santiago Bernabéu" },
  { id: "che-ars", homeId: "che", awayId: "ars", competition: "Premier League", status: "upcoming", kickoffIso: at(11, "14:00"), venue: "Stamford Bridge" },
  // finished
  { id: "ars-mun", homeId: "ars", awayId: "mun", competition: "Premier League", status: "finished", homeScore: 3, awayScore: 1, kickoffIso: at(-6, "15:00"), venue: "Emirates Stadium" },
  { id: "mci-tot", homeId: "mci", awayId: "tot", competition: "Premier League", status: "finished", homeScore: 2, awayScore: 2, kickoffIso: at(-5, "16:30"), venue: "Etihad Stadium" },
  { id: "liv-che", homeId: "liv", awayId: "che", competition: "Premier League", status: "finished", homeScore: 2, awayScore: 0, kickoffIso: at(-6, "17:30"), venue: "Anfield" },
  { id: "psg-bar", homeId: "psg", awayId: "bar", competition: "Champions League QF (1st leg)", status: "finished", homeScore: 2, awayScore: 3, kickoffIso: at(-9, "20:00"), venue: "Parc des Princes" },
  { id: "avl-tot", homeId: "avl", awayId: "tot", competition: "Premier League", status: "finished", homeScore: 1, awayScore: 0, kickoffIso: at(-9, "19:45"), venue: "Villa Park" },
  { id: "new-mun", homeId: "new", awayId: "mun", competition: "Premier League", status: "finished", homeScore: 2, awayScore: 1, kickoffIso: at(-14, "15:00"), venue: "St James' Park" },
];

export const matchById = new Map(matches.map((m) => [m.id, m]));

export const liveMatches = matches.filter((m) => m.status === "live");
export const upcomingMatches = matches.filter((m) => m.status === "upcoming");
export const finishedMatches = matches.filter((m) => m.status === "finished");

/* ---------- hand-authored detail for the featured match ---------- */

const featuredEvents: MatchEvent[] = [
  { minute: 1, type: "kickoff", detail: "We're underway under the Emirates lights." },
  { minute: 9, type: "chance", teamId: "liv", player: "Alexander Isak", detail: "Isak glides past Saliba but drags wide of the far post. 0.31 xG." },
  { minute: 17, type: "goal", teamId: "ars", player: "Bukayo Saka", detail: "Saka cuts in off the right and curls into the top corner. Trademark. 1–0." },
  { minute: 24, type: "yellow", teamId: "liv", player: "Virgil van Dijk", detail: "Late on Ødegaard as Arsenal spring the press." },
  { minute: 33, type: "chance", teamId: "ars", player: "Kai Havertz", detail: "Free header from Rice's corner — straight at the keeper." },
  { minute: 41, type: "goal", teamId: "liv", player: "Florian Wirtz", detail: "Wirtz plays a one-two with Isak and slots first time. 1–1." },
  { minute: 45, type: "half", detail: "Half-time: breathless. xG 1.12–0.98." },
  { minute: 52, type: "var", detail: "VAR check — possible penalty for handball against Van Dijk. No penalty given." },
  { minute: 58, type: "goal", teamId: "ars", player: "Declan Rice", detail: "Rice arrives late on the cut-back and buries it. Emirates erupts. 2–1." },
  { minute: 63, type: "sub", teamId: "liv", player: "Mohamed Salah", detail: "Salah on for Gakpo — Slot goes for the throat." },
  { minute: 66, type: "chance", teamId: "liv", player: "Mohamed Salah", detail: "Instantly dangerous: Salah's near-post snapshot forces Raya low." },
];

const featuredCommentary: MatchDetail["aiCommentary"] = [
  { minute: 12, kind: "tactical", text: "Liverpool are pressing man-for-man but Ødegaard keeps dropping into the right half-space to create a free third-man. Arsenal's escape rate under press: 78%." },
  { minute: 18, kind: "insight", text: "Saka's goal follows the model: 71% of his open-play goals start from receiving 1v1 beyond the left-back's front foot. Robertson is getting no cover from Wirtz's side." },
  { minute: 38, kind: "tactical", text: "Slot has flipped Wirtz and Mac Allister. Wirtz now attacks the space Rice vacates when he steps onto Isak's drop — the equaliser is brewing from exactly that pocket." },
  { minute: 42, kind: "event", text: "Called it. The one-two with Isak happened in the Rice-vacated pocket. FootIQ flagged that zone as Liverpool's highest-value entry corridor 4 minutes before the goal." },
  { minute: 60, kind: "insight", text: "Rice's goal is Arsenal's 9th from cut-backs this season — most in the league. Their left-side overload pulled 4 defenders before the reverse to the D." },
  { minute: 67, kind: "tactical", text: "With Salah on, Liverpool's expected threat from the right wing has tripled. Arsenal's momentum is dipping — Arteta is signalling for Timber to stay deeper." },
];

/* ---------- procedural detail for any other match ---------- */

const CHANCE_LINES = [
  "cuts inside and forces a smart save at the near post",
  "heads over from the resulting corner",
  "slips the offside trap but the flag denies the finish",
  "rattles the crossbar from 22 yards",
  "wins the duel and tests the keeper low",
];

/** Zeroed stats for a fixture that has not kicked off — nothing has happened yet. */
const EMPTY_SIDE_STATS: SideStats = {
  possession: 0,
  shots: 0,
  shotsOnTarget: 0,
  xG: 0,
  bigChances: 0,
  passes: 0,
  passAccuracy: 0,
  corners: 0,
  fouls: 0,
  tackles: 0,
  saves: 0,
};

function buildStats(matchId: string, homeAtk: number, awayAtk: number, live: boolean, minute: number): { home: SideStats; away: SideStats } {
  const rnd = seeded(hashCode(matchId + "stats"));
  const scale = live ? minute / 90 : 1;
  const posHome = clamp(50 + (homeAtk - awayAtk) * 8 + (rnd() - 0.5) * 10, 32, 68);
  const mk = (atk: number, pos: number): SideStats => {
    const shots = Math.round((8 + atk * 6 + rnd() * 4) * scale);
    return {
      possession: Math.round(pos),
      shots,
      shotsOnTarget: Math.round(shots * (0.3 + rnd() * 0.2)),
      xG: Math.round((shots * (0.09 + rnd() * 0.05)) * 100) / 100,
      passes: Math.round((320 + pos * 6 + rnd() * 60) * scale),
      passAccuracy: Math.round(76 + pos * 0.2 + rnd() * 6),
      corners: Math.round((3 + rnd() * 5) * scale),
      fouls: Math.round((7 + rnd() * 6) * scale),
      bigChances: Math.round((1 + atk * 2 + rnd() * 2) * scale),
      tackles: Math.round((12 + rnd() * 8) * scale),
      saves: Math.round((1 + rnd() * 4) * scale),
    };
  };
  return { home: mk(homeAtk, posHome), away: mk(awayAtk, 100 - posHome) };
}

function proceduralEvents(m: Match, resolveTeam: (id: string) => Team): MatchEvent[] {
  const rnd = seeded(hashCode(m.id + "events"));
  const minute = m.status === "live" ? (m.minute ?? 45) : 90;
  const events: MatchEvent[] = [{ minute: 1, type: "kickoff", detail: "Kick-off." }];
  const homeName = resolveTeam(m.homeId).short;
  const awayName = resolveTeam(m.awayId).short;
  const homeLineup = lineupFor(m.homeId, m.id, resolveTeam(m.homeId));
  const awayLineup = lineupFor(m.awayId, m.id, resolveTeam(m.awayId));
  const scorers = (lineup: typeof homeLineup) => lineup.players.filter((p) => p.pos !== "GK").slice(5);

  const addGoals = (n: number, teamId: string, lineup: typeof homeLineup) => {
    const side = teamId === m.homeId ? homeName : awayName;
    for (let i = 0; i < n; i++) {
      const min = Math.floor(rnd() * (minute - 6)) + 4;
      const cand = scorers(lineup);
      // synced teams without a demo squad have empty lineups — generic line instead of a named scorer
      const scorer = cand.length ? cand[Math.floor(rnd() * cand.length)] : null;
      events.push({
        minute: min,
        type: "goal",
        teamId,
        player: scorer?.name,
        detail: scorer ? `${scorer.name} finishes for ${side}.` : `Goal for ${side}.`,
      });
    }
  };
  addGoals(m.homeScore ?? 0, m.homeId, homeLineup);
  addGoals(m.awayScore ?? 0, m.awayId, awayLineup);

  const extras = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < extras; i++) {
    if (homeLineup.players.length < 11 || awayLineup.players.length < 11) break;
    const min = Math.floor(rnd() * (minute - 4)) + 3;
    const homeSide = rnd() < 0.5;
    const lineup = homeSide ? homeLineup : awayLineup;
    const p = lineup.players[Math.floor(rnd() * 10) + 1];
    const kind = rnd();
    if (kind < 0.55) events.push({ minute: min, type: "chance", teamId: homeSide ? m.homeId : m.awayId, player: p.name, detail: `${p.name} ${CHANCE_LINES[Math.floor(rnd() * CHANCE_LINES.length)]}.` });
    else if (kind < 0.85) events.push({ minute: min, type: "yellow", teamId: homeSide ? m.homeId : m.awayId, player: p.name, detail: `${p.name} goes into the book.` });
    else events.push({ minute: min, type: "sub", teamId: homeSide ? m.homeId : m.awayId, player: p.name, detail: `Change: ${p.name} makes way.` });
  }
  if (minute > 45) events.push({ minute: 45, type: "half", detail: "Half-time." });
  if (m.status === "finished") events.push({ minute: 90, type: "full", detail: "Full-time." });
  return events.sort((a, b) => a.minute - b.minute);
}

export function matchDetail(id: string): MatchDetail {
  const m = matchById.get(id);
  if (!m) throw new Error(`Unknown match: ${id}`);
  return matchDetailFor(m);
}

/**
 * Detail from a Match object directly — the path for synced (non-demo)
 * matches, whose ids aren't in the bundled dataset. Events/lineups/momentum
 * are deterministic derivations of the id, same as demo matches.
 *
 * `resolveTeam` MUST be supplied for provider-synced matches. It defaults to
 * the bundled demo lookup, which throws on any club outside the 12-team demo
 * set — so a real fixture (Atlético, id "fd-78") crashed the caller: a blank
 * homepage in the browser and a 500 from /api/matches/:id. Callers that hold
 * the real catalog pass their own resolver.
 */
export function matchDetailFor(m: Match, resolveTeam: (id: string) => Team = getTeam): MatchDetail {
  const home = resolveTeam(m.homeId);
  const away = resolveTeam(m.awayId);
  const homeAtk = (home.gf / Math.max(1, home.played)) / 2.6;
  const awayAtk = (away.gf / Math.max(1, away.played)) / 2.6;
  const minute = m.status === "live" ? (m.minute ?? 45) : 90;
  const scoreEdge = (m.homeScore ?? 0) - (m.awayScore ?? 0);

  /**
   * Has a ball actually been kicked?
   *
   * Everything below this line — events, possession, xG, momentum, the XI that
   * took the field — is a claim about play that HAPPENED. For a fixture that
   * hasn't kicked off, all of it is fiction about a specific real match, which
   * is worse than demo data: it is a demo-engine invention wearing a real
   * fixture's name. A fixture five weeks out was returning six match events.
   *
   * So unplayed matches get nothing. The UI shows a fixture, not a match
   * report. Previews (aiCommentary/tacticalNote) survive because they are
   * explicitly framed as inference and render inside amber IQInsight blocks.
   */
  const played = m.status === "live" || m.status === "finished";

  const { home: hs, away: as } = played
    ? buildStats(m.id, homeAtk, awayAtk, m.status === "live", minute)
    : { home: EMPTY_SIDE_STATS, away: EMPTY_SIDE_STATS };

  const detail: MatchDetail = {
    ...m,
    events: !played ? [] : m.id === "ars-liv" ? featuredEvents : proceduralEvents(m, resolveTeam),
    home: hs,
    away: as,
    momentum: played
      ? momentumFor(m.id, clamp(scoreEdge * 0.3 + (homeAtk - awayAtk), -0.8, 0.8)).slice(0, Math.max(4, Math.ceil(minute / 5)))
      : [],
    // A lineup is who started. Before kickoff nobody has.
    homeLineup: played ? lineupFor(m.homeId, m.id, home) : { formation: home.style.formation, players: [] },
    awayLineup: played ? lineupFor(m.awayId, m.id, away) : { formation: away.style.formation, players: [] },
    aiCommentary:
      m.id === "ars-liv"
        ? featuredCommentary
        : played
          ? [
              { minute: Math.min(18, minute), kind: "tactical", text: `${home.short} are building in a ${home.style.formation} against the ${away.short} ${away.style.press.toLowerCase()}. Expect the game to live in the wide channels.` },
              { minute: Math.min(34, minute), kind: "insight", text: `${away.short}'s ${away.styleTags[0].toLowerCase()} identity is producing the higher-quality entries so far — xG per shot ${(as.xG / Math.max(1, as.shots)).toFixed(2)} vs ${(hs.xG / Math.max(1, hs.shots)).toFixed(2)}.` },
            ]
          : [
              // Framed as expectation, not observation — no scoreline, no xG.
              { minute: 0, kind: "tactical", text: `${home.short} line up in a ${home.style.formation} against ${away.short}'s ${away.style.press.toLowerCase()}. The wide channels are where this one should be decided.` },
            ],
    tacticalNote:
      m.id === "ars-liv"
        ? "Arsenal's left-side overloads against Liverpool's aggressive right-back are deciding this match. Both goals for the hosts originated as switches away from a 4v3 overload."
        : `${home.short}'s ${home.styleTags[0].toLowerCase()} approach meets ${away.short}'s ${away.styleTags[0].toLowerCase()} — the midfield second-ball battle will decide territory.`,
  };
  return detail;
}

/** Fixtures/results slices for a team page. */
export function teamMatches(teamId: string): { fixtures: Match[]; results: Match[] } {
  return {
    fixtures: matches.filter((m) => m.status !== "finished" && (m.homeId === teamId || m.awayId === teamId)),
    results: matches.filter((m) => m.status === "finished" && (m.homeId === teamId || m.awayId === teamId)),
  };
}
