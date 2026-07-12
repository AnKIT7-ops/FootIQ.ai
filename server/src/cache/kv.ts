import type { CacheStore } from "./types";

/** Minimal structural type for a Cloudflare KV namespace binding. */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare KV adapter. KV is eventually consistent and has no atomic INCR,
 * so `increment` is read-modify-write — good enough for coarse rate limiting
 * on a single POP, and documented as such. For strict limits use Upstash.
 */
export class KvCache implements CacheStore {
  constructor(private kv: KVNamespaceLike) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.kv.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      // KV minimum TTL is 60s
      await this.kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
    } catch {
      /* fail open */
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch {
      /* fail open */
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, ttlSeconds);
    return next;
  }
}
