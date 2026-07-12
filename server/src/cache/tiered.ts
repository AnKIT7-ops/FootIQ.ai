import type { CacheStore } from "./types";
import { MemoryCache } from "./memory";

/**
 * Two-layer cache: hot in-memory front (short TTL) over a shared remote
 * back (Upstash/KV). Reads hit memory first — a snapshot fetch that would
 * cost a network round trip per request costs one per FRONT_TTL instead.
 *
 * Correctness notes:
 *  - increment() goes STRAIGHT to the remote: rate limiting must count on
 *    shared state, never per-instance memory.
 *  - delete() clears both layers; the front TTL bounds cross-instance
 *    staleness after another instance's delete/set to ≤ FRONT_TTL seconds.
 */
const FRONT_TTL = 30;

export class TieredCache implements CacheStore {
  private front = new MemoryCache();

  constructor(private back: CacheStore) {}

  async get<T>(key: string): Promise<T | null> {
    const hot = await this.front.get<T>(key);
    if (hot !== null) return hot;
    const cold = await this.back.get<T>(key);
    if (cold !== null) await this.front.set(key, cold, FRONT_TTL);
    return cold;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.front.set(key, value, Math.min(ttlSeconds, FRONT_TTL));
    await this.back.set(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.front.delete(key);
    await this.back.delete(key);
  }

  increment(key: string, ttlSeconds: number): Promise<number> {
    return this.back.increment(key, ttlSeconds); // shared counters only
  }
}
