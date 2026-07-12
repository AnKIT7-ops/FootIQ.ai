/**
 * Cache abstraction — one interface, three backends:
 *   MemoryCache   dev/test + last-resort fallback (per-instance, not shared)
 *   UpstashCache  Redis-compatible REST (free tier), works on Node + Workers
 *   KvCache       Cloudflare KV binding (Workers only)
 *
 * Values are JSON-serialized by the store. Keys are namespaced by callers via
 * cacheKeys — never hand-build key strings at call sites.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Atomic increment with TTL on first write — the rate limiter primitive. */
  increment(key: string, ttlSeconds: number): Promise<number>;
}

/** TTLs (seconds) per data class. Tune here, not at call sites. */
export const TTL = {
  players: 60 * 60 * 6,
  teams: 60 * 60 * 6,
  matches: 60,             // live-adjacent: keep short
  news: 60 * 5,
  transfers: 60 * 10,
  predictions: 60 * 15,
  clips: 60 * 60,
  history: 60 * 60 * 24,
  fantasy: 60 * 30,
  search: 60 * 10,
  flags: 60,               // flag flips should land within a minute
  aiScout: 60 * 60 * 24,   // deterministic per player+task: cache hard
  aiSummary: 60 * 60 * 6,
  aiGeneric: 60 * 60,
} as const;

export const cacheKeys = {
  catalog: (domain: string) => `cat:${domain}:v1`,
  search: (q: string) => `search:v1:${q.toLowerCase().slice(0, 80)}`,
  flags: () => "flags:v1",
  ai: (task: string, hash: string) => `ai:v1:${task}:${hash}`,
  rate: (scope: string, id: string, windowStart: number) => `rl:${scope}:${id}:${windowStart}`,
  quota: (userId: string, metric: string, day: string) => `q:${userId}:${metric}:${day}`,
} as const;
