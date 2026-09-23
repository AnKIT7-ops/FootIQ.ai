import type { Player, Position } from "@/data/types";
import type { ScoutFilters } from "@shared/contracts";

/**
 * Real-stat maths for player pages — everything is computed from FPL's
 * measured season totals. Percentiles compare a player with others in the same
 * position who have a meaningful sample; nothing here is a scouting grade.
 */

/** Below ~three full matches, per-90 rates are noise: such players aren't ranked against. */
export const MIN_MINUTES = 270;

export const per90 = (value: number, minutes: number): number => (minutes > 0 ? (value * 90) / minutes : 0);

export type MetricKey = "goals" | "xG" | "assists" | "xA" | "tackles" | "cbi" | "recoveries" | "saves" | "cleanSheets" | "conceded";

interface Metric {
  label: string;
  value: (p: Player) => number;
  /** Goals conceded: fewer is better, so the percentile is inverted. */
  lowerIsBetter?: boolean;
}

export const METRICS: Record<MetricKey, Metric> = {
  goals: { label: "Goals", value: (p) => per90(p.stats.goals, p.stats.minutes) },
  xG: { label: "xG", value: (p) => per90(p.stats.xG, p.stats.minutes) },
  assists: { label: "Assists", value: (p) => per90(p.stats.assists, p.stats.minutes) },
  xA: { label: "xA", value: (p) => per90(p.stats.xA, p.stats.minutes) },
  tackles: { label: "Tackles", value: (p) => per90(p.stats.tackles, p.stats.minutes) },
  cbi: { label: "Clear./blocks/int.", value: (p) => per90(p.stats.cbi, p.stats.minutes) },
  recoveries: { label: "Recoveries", value: (p) => per90(p.stats.recoveries, p.stats.minutes) },
  saves: { label: "Saves", value: (p) => per90(p.stats.saves, p.stats.minutes) },
  cleanSheets: { label: "Clean sheets", value: (p) => per90(p.stats.cleanSheets, p.stats.minutes) },
  conceded: { label: "Goals conceded", value: (p) => per90(p.stats.goalsConceded, p.stats.minutes), lowerIsBetter: true },
};

/** The numbers that describe each job. */
export const AXES: Record<Position, MetricKey[]> = {
  GK: ["saves", "cleanSheets", "conceded", "recoveries"],
  DF: ["tackles", "cbi", "recoveries", "xA", "xG", "cleanSheets"],
  MF: ["goals", "xG", "assists", "xA", "tackles", "recoveries"],
  FW: ["goals", "xG", "assists", "xA", "recoveries", "tackles"],
};

// Sorted per-position values, rebuilt only when the players array is swapped.
const cache = new WeakMap<Player[], Map<string, number[]>>();

function sortedValues(all: Player[], position: Position, key: MetricKey): number[] {
  let byKey = cache.get(all);
  if (!byKey) cache.set(all, (byKey = new Map()));
  const id = `${position}:${key}`;
  let values = byKey.get(id);
  if (!values) {
    values = all
      .filter((p) => p.position === position && p.stats.minutes >= MIN_MINUTES)
      .map(METRICS[key].value)
      .sort((a, b) => a - b);
    byKey.set(id, values);
  }
  return values;
}

/** 0–100: share of same-position regulars this player out-does on `key` (ties count half). */
export function percentile(all: Player[], p: Player, key: MetricKey): number {
  const values = sortedValues(all, p.position, key);
  if (values.length === 0) return 0;
  const v = METRICS[key].value(p);
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  const pct = ((below + equal / 2) / values.length) * 100;
  return Math.round(METRICS[key].lowerIsBetter ? 100 - pct : pct);
}

export function profile(all: Player[], p: Player): { key: MetricKey; label: string; per90: number; pct: number }[] {
  return AXES[p.position].map((key) => ({ key, label: METRICS[key].label, per90: METRICS[key].value(p), pct: percentile(all, p, key) }));
}

// ---- Scout traits: each is a measured output, not an opinion ------------------

export type Trait = ScoutFilters["traits"][number];

export const TRAITS: Record<Trait, { label: string; metrics: MetricKey[] }> = {
  scoring: { label: "scoring", metrics: ["goals", "xG"] },
  creating: { label: "chance creation", metrics: ["assists", "xA"] },
  defending: { label: "defending", metrics: ["tackles", "cbi"] },
  ball_winning: { label: "ball-winning", metrics: ["recoveries", "tackles"] },
  shot_stopping: { label: "shot-stopping", metrics: ["saves"] },
};

export function traitScore(all: Player[], p: Player, trait: Trait): number {
  const keys = TRAITS[trait].metrics;
  return keys.reduce((s, k) => s + percentile(all, p, k), 0) / keys.length;
}

// ---- similarity ---------------------------------------------------------------

/**
 * 0–100 statistical likeness: 100 minus the mean percentile gap across the
 * position's axes. Same position only — a keeper and a striker share no axes.
 */
export function similarity(all: Player[], a: Player, b: Player): number {
  if (a.position !== b.position) return 0;
  const keys = AXES[a.position];
  const gap = keys.reduce((s, k) => s + Math.abs(percentile(all, a, k) - percentile(all, b, k)), 0) / keys.length;
  return Math.round(100 - gap);
}

/** Axes where the two players sit closest — the "why they match". */
export function closestAxes(all: Player[], a: Player, b: Player, n = 2): string[] {
  return AXES[a.position]
    .map((k) => ({ k, d: Math.abs(percentile(all, a, k) - percentile(all, b, k)) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((x) => METRICS[x.k].label);
}

export const hasSample = (p: Player): boolean => p.stats.minutes >= MIN_MINUTES;
