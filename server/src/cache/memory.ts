import type { CacheStore } from "./types";

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * In-memory LRU-ish cache with TTL. Default backend for dev/test and the
 * fallback when no external cache is configured. Per-process: fine for a
 * single free-tier instance, documented limitation for horizontal scale.
 */
export class MemoryCache implements CacheStore {
  private store = new Map<string, Entry>();
  constructor(private maxEntries = 2000) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // refresh recency (Map iteration order = insertion order)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // evict oldest
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = await this.get<number>(key);
    if (current === null) {
      await this.set(key, 1, ttlSeconds);
      return 1;
    }
    const entry = this.store.get(key)!;
    entry.value = (current as number) + 1;
    return entry.value as number;
  }

  /** Test helper. */
  clear(): void {
    this.store.clear();
  }
}
