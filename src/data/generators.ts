// relative on purpose: the data layer is imported by the API server too, and
// must stay resolvable without Vite's "@" alias
import { hashCode, seeded, clamp } from "../lib/utils";
import type { LineupPlayer, Position } from "./types";
import { playersOf } from "./players";
import { getTeam } from "./teams";

/* ---------- squad depth generation (fills team squads around the star core) ---------- */

const FIRST = ["Marco", "Jaden", "Luca", "Theo", "Rafael", "Nico", "Emile", "Sergi", "Kaan", "Tommy", "Diego", "Ivan", "Noah", "Sami", "Jorge", "Felix", "Andre", "Louis", "Mats", "Dani"];
const LAST = ["Ferreira", "Okafor", "Lindqvist", "Marchetti", "Dubois", "Kovac", "Sørensen", "Alcántara", "Weber", "Hughes", "Romero", "Petit", "Zielinski", "Costa", "Bakker", "Silva", "Novak", "Beaumont", "Keller", "Iversen"];
const NATIONS: Array<[string, string]> = [["England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"], ["France", "🇫🇷"], ["Brazil", "🇧🇷"], ["Spain", "🇪🇸"], ["Germany", "🇩🇪"], ["Netherlands", "🇳🇱"], ["Portugal", "🇵🇹"], ["Argentina", "🇦🇷"], ["Denmark", "🇩🇰"], ["Croatia", "🇭🇷"]];

export interface DepthPlayer {
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

/** Deterministic depth squad so every team page fields ~18 players. */
export function depthSquad(teamId: string): DepthPlayer[] {
  const rnd = seeded(hashCode(teamId));
  const stars = playersOf(teamId);
  const need: Position[] = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "GK", "DF", "MF", "FW"];
  const have = new Set(stars.map((s) => s.id));
  const out: DepthPlayer[] = [];
  const usedShirts = new Set(stars.map((s) => s.shirt));

  need.forEach((pos, i) => {
    // skip slots the star core already covers well
    const coverage = stars.filter((s) => s.position === pos).length;
    const skip = (pos === "GK" && coverage > 0 && i < 10) || coverage > 2;
    if (skip && rnd() < 0.7) return;

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
  if (!have.size && out.length === 0) return out;
  return out;
}

/* ---------- pitch point clouds (heatmaps, shots, passes) ---------- */

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

export interface Shot {
  x: number; // 0-100, attacking right goal at x=100
  y: number;
  xg: number;
  outcome: "goal" | "saved" | "missed" | "blocked";
  minute: number;
}

export function shotMapFor(playerId: string, goals: number, xg: number): Shot[] {
  const rnd = seeded(hashCode(playerId + "shots"));
  const n = Math.max(10, Math.round(xg * 4 + 6));
  const shots: Shot[] = [];
  let goalsLeft = goals > 0 ? Math.min(goals, Math.round(goals * 0.6)) + 2 : 1;
  for (let i = 0; i < n; i++) {
    const central = rnd() < 0.62;
    const x = central ? 84 + rnd() * 13 : 72 + rnd() * 18;
    const y = central ? 38 + rnd() * 24 : 20 + rnd() * 60;
    const dist = Math.hypot(100 - x, 50 - y);
    const shotXg = clamp(0.75 - dist / 40 + rnd() * 0.15, 0.02, 0.85);
    let outcome: Shot["outcome"];
    const roll = rnd();
    if (goalsLeft > 0 && roll < shotXg + 0.12) {
      outcome = "goal";
      goalsLeft--;
    } else if (roll < 0.45) outcome = "saved";
    else if (roll < 0.75) outcome = "missed";
    else outcome = "blocked";
    shots.push({ x, y, xg: shotXg, outcome, minute: Math.floor(rnd() * 90) + 1 });
  }
  return shots;
}

export interface PassArrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: boolean; // key pass / assist-like
}

export function passMapFor(playerId: string, position: Position): PassArrow[] {
  const rnd = seeded(hashCode(playerId + "pass"));
  const n = 26;
  const out: PassArrow[] = [];
  const baseX = position === "DF" ? 30 : position === "MF" ? 52 : 68;
  for (let i = 0; i < n; i++) {
    const x1 = clamp(baseX + (rnd() - 0.5) * 34, 4, 92);
    const y1 = clamp(50 + (rnd() - 0.5) * 74, 4, 96);
    const forward = rnd() < 0.72;
    const x2 = clamp(x1 + (forward ? 8 + rnd() * 22 : -(4 + rnd() * 10)), 4, 98);
    const y2 = clamp(y1 + (rnd() - 0.5) * 36, 2, 98);
    out.push({ x1, y1, x2, y2, key: rnd() < 0.18 });
  }
  return out;
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

/** Build a plausible XI mixing star players into formation slots. */
export function lineupFor(teamId: string, opponentSeed: string): { formation: string; players: LineupPlayer[] } {
  const team = getTeam(teamId);
  const formation = FORMATION_SLOTS[team.style.formation] ? team.style.formation : "4-3-3";
  const slots = FORMATION_SLOTS[formation];
  const stars = playersOf(teamId);
  const depth = depthSquad(teamId);
  const rnd = seeded(hashCode(teamId + opponentSeed));

  const pool = {
    GK: [...stars.filter((p) => p.position === "GK"), ...depth.filter((p) => p.position === "GK")],
    DF: [...stars.filter((p) => p.position === "DF"), ...depth.filter((p) => p.position === "DF")],
    MF: [...stars.filter((p) => p.position === "MF"), ...depth.filter((p) => p.position === "MF")],
    FW: [...stars.filter((p) => p.position === "FW"), ...depth.filter((p) => p.position === "FW")],
  };
  const used = new Set<string>();
  const take = (pos: Position): { name: string; shirt: number; id?: string } => {
    const cand = pool[pos].find((p) => !used.has(p.id));
    if (cand) {
      used.add(cand.id);
      const isStar = "teamId" in cand;
      return { name: cand.name, shirt: cand.shirt, id: isStar ? cand.id : undefined };
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
