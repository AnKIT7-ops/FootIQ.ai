// relative on purpose: the data layer is imported by the API server too, and
// must stay resolvable without Vite's "@" alias
import { hashCode, seeded, clamp } from "../lib/utils";
import type { LineupPlayer, Position, Team } from "./types";
import { getTeam } from "./teams";

/* ---------- generic squads for demo fixtures ---------- */

const FIRST = ["Marco", "Jaden", "Luca", "Theo", "Rafael", "Nico", "Emile", "Sergi", "Kaan", "Tommy", "Diego", "Ivan", "Noah", "Sami", "Jorge", "Felix", "Andre", "Louis", "Mats", "Dani"];
const LAST = ["Ferreira", "Okafor", "Lindqvist", "Marchetti", "Dubois", "Kovac", "Sørensen", "Alcántara", "Weber", "Hughes", "Romero", "Petit", "Zielinski", "Costa", "Bakker", "Silva", "Novak", "Beaumont", "Keller", "Iversen"];
const NATIONS: Array<[string, string]> = [["England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"], ["France", "🇫🇷"], ["Brazil", "🇧🇷"], ["Spain", "🇪🇸"], ["Germany", "🇩🇪"], ["Netherlands", "🇳🇱"], ["Portugal", "🇵🇹"], ["Argentina", "🇦🇷"], ["Denmark", "🇩🇰"], ["Croatia", "🇭🇷"]];

interface DepthPlayer {
  id: string;
  name: string;
  position: Position;
  role: string;
  age: number;
  shirt: number;
  nationality: string;
  flag: string;
  rating: number;
  apps: number;
  goals: number;
  assists: number;
  marketValue: number;
}

const ROLE: Record<Position, string[]> = {
  GK: ["Goalkeeper"],
  DF: ["Centre-Back", "Right-Back", "Left-Back"],
  MF: ["Central Midfielder", "Defensive Midfielder"],
  FW: ["Winger", "Striker"],
};

/**
 * Deterministic generic squad for DEMO fixtures only (real fixtures never get
 * synthesized play). Invented names on purpose — real players are never put
 * into matches they didn't play.
 */
function depthSquad(teamId: string): DepthPlayer[] {
  const rnd = seeded(hashCode(teamId));
  const need: Position[] = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "GK", "DF", "MF", "FW"];
  const out: DepthPlayer[] = [];
  const usedShirts = new Set<number>();

  need.forEach((pos, i) => {
    let shirt = Math.floor(rnd() * 30) + 2;
    while (usedShirts.has(shirt)) shirt++;
    usedShirts.add(shirt);

    const nation = NATIONS[Math.floor(rnd() * NATIONS.length)];
    const roles = ROLE[pos];
    out.push({
      id: `${teamId}-d${i}`,
      name: `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`,
      position: pos,
      role: roles[Math.floor(rnd() * roles.length)],
      age: 19 + Math.floor(rnd() * 13),
      shirt,
      nationality: nation[0],
      flag: nation[1],
      rating: Math.round((6.3 + rnd() * 0.9) * 100) / 100,
      apps: Math.floor(rnd() * 24) + 4,
      goals: pos === "FW" ? Math.floor(rnd() * 8) : pos === "MF" ? Math.floor(rnd() * 4) : Math.floor(rnd() * 2),
      assists: pos === "FW" || pos === "MF" ? Math.floor(rnd() * 6) : Math.floor(rnd() * 2),
      marketValue: (Math.floor(rnd() * 38) + 4) * 1_000_000,
    });
  });
  return out;
}

/* ---------- pitch heat clouds (demo match pages) ---------- */

export interface HeatCell {
  x: number; // 0-100 length of pitch (attack →)
  y: number; // 0-100 width
  v: number; // 0-1 intensity
}

/** Position-aware heat cloud on a 12x8 grid. */
export function heatmapFor(playerId: string, position: Position, role: string): HeatCell[] {
  const rnd = seeded(hashCode(playerId + "heat"));
  const cells: HeatCell[] = [];
  // anchor zones by role
  const anchors: Array<[number, number, number]> = [];
  const left = role.includes("Left");
  const right = role.includes("Right") || (!left && rnd() > 0.5);
  const wideY = left ? 18 : right ? 82 : 50;

  if (position === "GK") anchors.push([6, 50, 1]);
  else if (position === "DF") {
    if (role.includes("Back") && (left || right)) anchors.push([30, wideY, 1], [58, wideY, 0.7]);
    else anchors.push([22, 38 + rnd() * 24, 1], [40, 50, 0.5]);
  } else if (position === "MF") {
    if (role.includes("Defensive")) anchors.push([38, 45 + rnd() * 10, 1], [55, 50, 0.6]);
    else if (role.includes("Attacking")) anchors.push([68, 40 + rnd() * 20, 1], [50, 50, 0.6]);
    else anchors.push([52, 35 + rnd() * 30, 1], [68, 50, 0.7]);
  } else {
    if (role.includes("Striker")) anchors.push([82, 42 + rnd() * 16, 1], [65, 50, 0.5]);
    else anchors.push([72, wideY, 1], [86, wideY > 50 ? 66 : 34, 0.7]);
  }

  for (let gx = 0; gx < 12; gx++) {
    for (let gy = 0; gy < 8; gy++) {
      const x = (gx + 0.5) * (100 / 12);
      const y = (gy + 0.5) * (100 / 8);
      let v = 0;
      for (const [ax, ay, w] of anchors) {
        const d2 = ((x - ax) / 26) ** 2 + ((y - ay) / 22) ** 2;
        v += w * Math.exp(-d2 * 2.2);
      }
      v = clamp(v + rnd() * 0.08 - 0.04, 0, 1);
      if (v > 0.05) cells.push({ x, y, v });
    }
  }
  return cells;
}

/* ---------- lineups ---------- */

const FORMATION_SLOTS: Record<string, Array<[number, number, Position]>> = {
  "4-3-3": [
    [50, 6, "GK"],
    [14, 22, "DF"], [38, 18, "DF"], [62, 18, "DF"], [86, 22, "DF"],
    [30, 42, "MF"], [50, 36, "MF"], [70, 42, "MF"],
    [16, 68, "FW"], [50, 76, "FW"], [84, 68, "FW"],
  ],
  "4-2-3-1": [
    [50, 6, "GK"],
    [14, 22, "DF"], [38, 18, "DF"], [62, 18, "DF"], [86, 22, "DF"],
    [38, 36, "MF"], [62, 36, "MF"],
    [18, 56, "MF"], [50, 54, "MF"], [82, 56, "MF"],
    [50, 78, "FW"],
  ],
  "3-4-2-1": [
    [50, 6, "GK"],
    [26, 18, "DF"], [50, 15, "DF"], [74, 18, "DF"],
    [10, 42, "MF"], [38, 38, "MF"], [62, 38, "MF"], [90, 42, "MF"],
    [36, 60, "FW"], [64, 60, "FW"],
    [50, 78, "FW"],
  ],
};

/**
 * Build a generic XI for a demo fixture.
 *
 * `team` may be passed by callers holding a provider-synced club: the bundled
 * `getTeam` throws for any id outside the demo set, which crashed every real
 * fixture's detail page.
 */
export function lineupFor(
  teamId: string,
  opponentSeed: string,
  team: Team = getTeam(teamId),
): { formation: string; players: LineupPlayer[] } {
  const formation = FORMATION_SLOTS[team.style.formation] ? team.style.formation : "4-3-3";
  const slots = FORMATION_SLOTS[formation];
  const depth = depthSquad(teamId);
  const rnd = seeded(hashCode(teamId + opponentSeed));

  const used = new Set<string>();
  const take = (pos: Position): { name: string; shirt: number; id?: string } => {
    const cand = depth.find((p) => p.position === pos && !used.has(p.id));
    if (cand) {
      used.add(cand.id);
      return { name: cand.name, shirt: cand.shirt };
    }
    // fabricate if pool exhausted
    const shirt = Math.floor(rnd() * 30) + 40;
    return { name: `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`, shirt };
  };

  const players: LineupPlayer[] = slots.map(([x, y, pos]) => {
    const pick = take(pos);
    return {
      playerId: pick.id,
      name: pick.name,
      shirt: pick.shirt,
      pos,
      x,
      y,
      rating: Math.round((6.2 + rnd() * 2.2) * 10) / 10,
    };
  });

  return { formation, players };
}

/* ---------- momentum ---------- */

/** Momentum series -1..1 (home positive), ~18 buckets for 90'. */
export function momentumFor(matchId: string, homeEdge: number): number[] {
  const rnd = seeded(hashCode(matchId + "momentum"));
  const out: number[] = [];
  let v = homeEdge * 0.2;
  for (let i = 0; i < 18; i++) {
    v += (rnd() - 0.5) * 0.55 + homeEdge * 0.05;
    v = clamp(v * 0.86 + homeEdge * 0.06, -1, 1);
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}
