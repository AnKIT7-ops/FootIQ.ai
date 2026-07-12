import { trackEvent } from "@/lib/analytics";

/**
 * Local product metrics — privacy-friendly usage counters in localStorage.
 * Powers the /insights dashboard without any backend; every bump also mirrors
 * to GA4 (when configured) so real analytics accumulate in parallel.
 * ponytail: device-local only; server-side aggregation is a Phase 4 item.
 */

export type MetricCategory = "entity_view" | "search" | "share" | "ai_use" | "newsletter";

type MetricsState = Record<MetricCategory, Record<string, number>>;

const KEY = "footiq-metrics";
const MAX_KEYS = 300; // per category — drop the coldest entries beyond this

const empty = (): MetricsState => ({ entity_view: {}, search: {}, share: {}, ai_use: {}, newsletter: {} });

function read(): MetricsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as Partial<MetricsState>;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

function write(state: MetricsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — counters are best-effort */
  }
}

/** Count one occurrence of `key` in `category` (e.g. bump("entity_view", "/players/saka")). */
export function bump(category: MetricCategory, key: string): void {
  if (!key) return;
  const state = read();
  const bucket = state[category];
  bucket[key] = (bucket[key] ?? 0) + 1;
  const keys = Object.keys(bucket);
  if (keys.length > MAX_KEYS) {
    for (const k of keys.sort((a, b) => bucket[a] - bucket[b]).slice(0, keys.length - MAX_KEYS)) delete bucket[k];
  }
  write(state);
  trackEvent(category, { key });
}

/** Top-n entries for a category, hottest first. */
export function top(category: MetricCategory, n = 10): Array<{ key: string; count: number }> {
  const bucket = read()[category];
  return Object.entries(bucket)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function totals(): Record<MetricCategory, number> {
  const state = read();
  return Object.fromEntries(
    (Object.keys(state) as MetricCategory[]).map((c) => [c, Object.values(state[c]).reduce((a, b) => a + b, 0)]),
  ) as Record<MetricCategory, number>;
}
