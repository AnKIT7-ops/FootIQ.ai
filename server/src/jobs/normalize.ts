import * as demo from "../data/demo";
import type { Match, Team } from "../data/demo";
import type { NormalizedMatch, NormalizedTeamStanding } from "../providers/types";
import { hashCode, seeded } from "../../../src/lib/utils";

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
    name: row.name,
    short: row.shortName ?? row.name.split(" ")[0],
    tla: row.tla ?? row.name.replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X"),
    colors: ["#334455", "#8899aa"],
    stadium: row.venue ?? "—",
    manager: row.coach ?? "—",
    league: "Synced League",
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
    styleTags: ["Synced", "Profile pending"],
    aiReport: [
      `${row.name} joined the catalog from a live data sync — the tactical profile builds as more of their matches are ingested.`,
    ],
    trophies: [],
  };
}

/** Standings overlay: matched demo teams keep their identity/squad, take provider numbers. */
export function mergeStandings(rows: NormalizedTeamStanding[]): Team[] {
  if (rows.length === 0) return demo.teams;
  const merged: Team[] = [];
  const claimed = new Set<string>();
  for (const row of rows) {
    const base = matchDemoTeam(row);
    if (base) {
      claimed.add(base.id);
      merged.push({
        ...base,
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
      });
    } else {
      merged.push(synthesizeTeam(row));
    }
  }
  // demo teams outside the synced competition stay available (other leagues in the dataset)
  for (const t of demo.teams) if (!claimed.has(t.id)) merged.push(t);
  return merged;
}

const kickoffDisplay = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} ${d
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;
};

/** Fixture merge: provider matches, ids stabilized, team refs resolved against the merged team list. */
export function mergeMatches(
  rows: NormalizedMatch[],
  teams: Team[],
): { live: Match[]; upcoming: Match[]; finished: Match[] } {
  if (rows.length === 0) {
    return { live: demo.liveMatches, upcoming: demo.upcomingMatches, finished: demo.finishedMatches };
  }
  const byCanon = new Map(teams.map((t) => [canon(t.name), t]));
  const grouped = { live: [] as Match[], upcoming: [] as Match[], finished: [] as Match[] };

  for (const row of rows) {
    const home = byCanon.get(canon(row.homeName));
    const away = byCanon.get(canon(row.awayName));
    if (!home || !away) continue; // a side we can't resolve — skip rather than render broken links
    grouped[row.status].push({
      id: row.extId,
      homeId: home.id,
      awayId: away.id,
      competition: row.competition,
      status: row.status,
      minute: row.minute,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      kickoff: kickoffDisplay(row.kickoffIso),
      venue: row.venue ?? home.stadium,
    });
  }

  grouped.upcoming.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return grouped;
}
