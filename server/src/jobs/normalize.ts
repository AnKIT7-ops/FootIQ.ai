import * as demo from "../data/demo";
import type { Match, MatchStatus, Team } from "../data/demo";
import type { NormalizedMatch, NormalizedTeam, NormalizedTeamStanding } from "../providers/types";
import { hashCode, seeded } from "../../../src/lib/utils";

/** Fixtures bucketed by status — the shape the matches snapshot holds. */
export type MatchesGrouped = Record<MatchStatus, Match[]>;

/**
 * Normalization merge — provider truth over demo richness.
 *
 * Free-tier providers give standings and fixtures, not attributes, xG or
 * tactical dials. So the merge overlays what the provider KNOWS (table
 * numbers, scores, kickoffs, coach) onto the demo entity when names match,
 * and synthesizes deterministic FootIQ-specific fields for teams the demo
 * has never seen. Output shapes are the full catalog model — the API and
 * frontend cannot tell which fields came from where (that's the point).
 */

const canon = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\b(fc|afc|cf|ac|as|ssc|club|de|f\.c\.)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** Find the demo team a provider row refers to (name or TLA), if any. */
function matchDemoTeam(row: { name: string; tla?: string; shortName?: string }): Team | undefined {
  const target = canon(row.name);
  return demo.teams.find(
    (t) =>
      canon(t.name) === target ||
      (row.tla && t.tla.toLowerCase() === row.tla.toLowerCase()) ||
      (row.shortName && canon(t.short) === canon(row.shortName)),
  );
}

function synthesizeTeam(row: NormalizedTeamStanding): Team {
  const rnd = seeded(hashCode(row.name));
  const dial = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const formations = ["4-3-3", "4-2-3-1", "3-4-2-1", "4-4-2"];
  return {
    id: row.extId,
    extId: row.extId,
    name: row.name,
    short: row.shortName ?? row.name.split(" ")[0],
    tla: row.tla ?? row.name.replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X"),
    colors: ["#334455", "#8899aa"],
    stadium: row.venue ?? "—",
    manager: row.coach ?? "—",
    league: row.competition || "Synced League",
    position: row.position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    gf: row.gf,
    ga: row.ga,
    points: row.points,
    form: row.form?.slice(0, 5) ?? "",
    chemistry: dial(55, 85),
    style: {
      formation: formations[Math.floor(rnd() * formations.length)],
      buildUp: "Balanced build-up",
      press: "Mid-block press",
      line: "Medium line",
      tempo: dial(40, 80),
      width: dial(40, 80),
      directness: dial(30, 70),
      pressIntensity: dial(40, 80),
    },
    styleTags: ["Balanced", "Profile pending"],
    aiReport: [
      `${row.name} joined the catalog from a live data sync — the tactical profile builds as more of their matches are ingested.`,
    ],
    trophies: [],
  };
}

/**
 * Standings overlay: matched demo teams keep their identity/squad, take provider
 * numbers. The result is EXACTLY the synced competitions' tables — nothing else.
 *
 * Demo teams from other competitions are deliberately NOT appended here. They
 * used to be, so their pages kept working, but the snapshot is what feeds the
 * league table: carrying them in put four demo clubs with fabricated points
 * (Real Madrid 73, Bayern 70…) into a provider-sourced Premier League table,
 * outranking every real row — a fabricated number wearing the emerald
 * "measured fact" chip. CatalogService unions them back for lookup and search,
 * where they belong.
 *
 * Empty in, empty out. An empty table is a fact ("no standings synced"); demo
 * teams returned from a provider-sourced sync are a lie the caller cannot
 * detect, because the shape is identical either way.
 *
 * Multi-competition dedupe: a club in both its domestic league and a European
 * cup returns one standings row per competition under the SAME provider id.
 * First row wins, and competitions sync domestic-first, so Arsenal keeps
 * "Premier League" (20 rows, position meaningful) rather than being overwritten
 * by its Champions League row. Clubs seen ONLY in a cup keep that cup as their
 * league — we genuinely have not seen their domestic table.
 */
export function mergeStandings(rows: NormalizedTeamStanding[]): Team[] {
  const seen = new Set<string>();
  const out: Team[] = [];
  for (const row of rows) {
    if (seen.has(row.extId)) continue;
    seen.add(row.extId);
    const base = matchDemoTeam(row);
    out.push(
      !base
        ? synthesizeTeam(row)
        : {
            ...base,
            // Remember who the provider thinks this is. The demo name stays
            // (nicer, and it carries the squad/identity), so fixtures can only
            // find this club again by id.
            extId: row.extId,
            league: row.competition || base.league,
            position: row.position,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            gf: row.gf,
            ga: row.ga,
            points: row.points,
            form: row.form?.slice(0, 5) || base.form,
            stadium: row.venue ?? base.stadium,
            manager: row.coach ?? base.manager,
          },
    );
  }
  return out;
}

/** "Red / White / Blue" → the two colours the UI actually uses. */
function parseClubColors(raw: string | undefined): [string, string] | undefined {
  if (!raw) return undefined;
  const NAMED: Record<string, string> = {
    red: "#e11d48", blue: "#2563eb", white: "#f8fafc", black: "#0f172a", yellow: "#facc15",
    green: "#16a34a", orange: "#f97316", purple: "#7c3aed", maroon: "#7f1d1d", navy: "#1e3a5f",
    claret: "#7a263a", sky: "#38bdf8", gold: "#d4af37", silver: "#cbd5e1", grey: "#94a3b8",
    gray: "#94a3b8", burgundy: "#800020", pink: "#ec4899", brown: "#78350f",
  };
  const hits = raw
    .toLowerCase()
    .split(/[/,]/)
    .map((s) => s.trim().split(/\s+/).find((w) => NAMED[w]))
    .filter((w): w is string => Boolean(w))
    .map((w) => NAMED[w]);
  if (hits.length === 0) return undefined;
  return [hits[0], hits[1] ?? hits[0]];
}

/**
 * Club identity from the provider, folded onto the existing catalog.
 *
 * Provider truth wins for every field it actually supplies — crest, venue,
 * founded, colours, coach. The team's `id` does NOT change: demo players
 * reference their club by id ("ars"), so re-keying teams to provider ids would
 * orphan every player, empty every squad, and break Compare/Scout/Similar. The
 * id is a join key; the DATA behind it is now real.
 *
 * Clubs the catalog has never seen are added outright, so a competition's full
 * roster exists even where the demo set never had it.
 */
export function mergeTeams(existing: Team[], rows: NormalizedTeam[]): Team[] {
  if (rows.length === 0) return existing;
  const byExtId = new Map(existing.filter((t) => t.extId).map((t) => [t.extId!, t]));
  const byName = new Map(existing.map((t) => [canon(t.name), t]));
  const out = [...existing];
  const indexOf = new Map(existing.map((t, i) => [t.id, i]));

  for (const row of rows) {
    const base = byExtId.get(row.extId) ?? byName.get(canon(row.name));
    const colors = parseClubColors(row.clubColors);
    if (!base) {
      // A club we've never seen: synthesize the FootIQ-specific dials, then
      // overlay the real identity on top.
      const made = synthesizeTeam({
        extId: row.extId, name: row.name, competition: row.competition, tla: row.tla,
        shortName: row.shortName, crestUrl: row.crestUrl, venue: row.venue,
        position: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
      });
      out.push({
        ...made,
        crestUrl: row.crestUrl ?? made.crestUrl,
        founded: row.founded,
        stadium: row.venue ?? made.stadium,
        manager: row.coach ?? made.manager,
        squad: row.squad,
        ...(colors ? { colors } : {}),
      });
      continue;
    }
    const i = indexOf.get(base.id);
    if (i === undefined) continue;
    // Build on the CURRENT row, not `base`: a club listed in two competitions
    // (Arsenal: PL + CL) gets two rows, and starting over from `base` let the
    // second erase what the first added.
    const cur = out[i];
    out[i] = {
      ...cur,
      extId: row.extId,
      // Identity from the provider; `id` and tactical dials stay put.
      short: row.shortName ?? cur.short,
      tla: row.tla ?? cur.tla,
      crestUrl: row.crestUrl ?? cur.crestUrl,
      founded: row.founded ?? cur.founded,
      stadium: row.venue ?? cur.stadium,
      // Free tier leaves coach null for every club — don't overwrite a real
      // demo manager name with nothing.
      manager: row.coach ?? cur.manager,
      // The CL endpoint returns empty squads for most clubs — never let [] replace a real one.
      squad: row.squad?.length ? row.squad : cur.squad,
      ...(colors ? { colors } : {}),
    };
  }
  return out;
}

/**
 * Minimal club built from a fixture alone — no table position, because we have
 * no table for it. Its league is the competition the fixture belongs to, which
 * is the one thing we genuinely know about it; leaving it blank put an empty
 * entry in the competition picker.
 */
function teamFromFixture(extId: string, name: string, competition: string, tla?: string, crestUrl?: string): Team {
  return synthesizeTeam({
    extId,
    name,
    competition,
    tla,
    crestUrl,
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
  });
}

/**
 * Fixture merge: provider matches, ids stabilized, team refs resolved against
 * the merged team list.
 *
 * Resolution is by PROVIDER ID, not name. Names failed two ways in production:
 * a demo-matched club keeps its demo name ("Bayern Munich") while its fixtures
 * arrive as "FC Bayern München", and canonicalization cannot bridge that; and
 * standings roll over to a new season at a different time than fixtures do, so
 * in July the La Liga table is still 2025-26 while the fixtures are 2026-27 and
 * every newly-promoted club (Málaga, Racing, Deportivo…) is missing from it.
 * Both cases dropped real fixtures silently — indistinguishable from "no
 * matches scheduled".
 *
 * So a fixture may INTRODUCE a club: if the standings have never heard of it,
 * synthesize a minimal team from the fixture payload rather than discard the
 * match. Returned alongside the fixtures for the caller to fold into the team
 * snapshot. Name matching stays as a fallback for providers that don't expose
 * team ids.
 *
 * Empty in, empty out — no demo fallback. This function used to return the
 * bundled demo fixtures whenever the provider yielded zero rows, which is
 * exactly the state a correctly-working sync reports during the off-season.
 * The result was a permanently "live" 67th-minute Arsenal fixture served with
 * provider provenance. Zero rows now means zero matches, and the UI says so.
 *
 * Kickoffs stay ISO 8601 — formatting is the frontend's job, in the reader's
 * timezone. The old display string ("Sat 15 Mar 14:30", baked to UTC here)
 * could not be sorted, compared, or localized downstream.
 */
/** 90' + half-time + extra time + penalties + generous stoppage/delay. Past this, "live" is a stale feed. */
const MAX_LIVE_MS = 3 * 60 * 60 * 1000;

export function mergeMatches(
  rows: NormalizedMatch[],
  teams: Team[],
  now = Date.now(),
): { grouped: MatchesGrouped; discoveredTeams: Team[] } {
  const byExtId = new Map(teams.filter((t) => t.extId).map((t) => [t.extId!, t]));
  const byCanon = new Map(teams.map((t) => [canon(t.name), t]));
  const discovered = new Map<string, Team>();
  const grouped: MatchesGrouped = { live: [], upcoming: [], finished: [], postponed: [], cancelled: [], unconfirmed: [] };

  const resolve = (extId: string, name: string, competition: string, tla?: string, crest?: string): Team => {
    const known = byExtId.get(extId) ?? byCanon.get(canon(name));
    if (known) return known;
    let made = discovered.get(extId);
    if (!made) {
      made = teamFromFixture(extId, name, competition, tla, crest);
      discovered.set(extId, made);
    }
    return made;
  };

  for (const row of rows) {
    const home = resolve(row.homeExtId, row.homeName, row.competition, row.homeTla, row.homeCrestUrl);
    const away = resolve(row.awayExtId, row.awayName, row.competition, row.awayTla, row.awayCrestUrl);
    // Providers can leave a match IN_PLAY for hours after it ends (football-data.org
    // did, 2026-09-17). Its score is as stale as its status, so both go.
    const stuck = row.status === "live" && now - Date.parse(row.kickoffIso) > MAX_LIVE_MS;
    const status = stuck ? "unconfirmed" : row.status;
    grouped[status].push({
      id: row.extId,
      homeId: home.id,
      awayId: away.id,
      competition: row.competition,
      status,
      minute: stuck ? undefined : row.minute,
      homeScore: stuck ? undefined : row.homeScore,
      awayScore: stuck ? undefined : row.awayScore,
      kickoffIso: row.kickoffIso,
      venue: row.venue ?? home.stadium,
    });
  }

  const byKickoff = (a: Match, b: Match) => a.kickoffIso.localeCompare(b.kickoffIso);
  grouped.upcoming.sort(byKickoff);
  grouped.postponed.sort(byKickoff);
  grouped.cancelled.sort(byKickoff);
  grouped.finished.sort((a, b) => byKickoff(b, a)); // most recent result first
  grouped.unconfirmed.sort((a, b) => byKickoff(b, a));
  return { grouped, discoveredTeams: [...discovered.values()] };
}
