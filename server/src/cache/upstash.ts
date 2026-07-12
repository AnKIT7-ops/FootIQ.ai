import type { CacheStore } from "./types";

/**
 * Upstash Redis over REST — fetch-only, so it runs identically on Node and
 * Cloudflare Workers with zero driver dependencies. Free tier: 500k
 * commands/month, plenty for beta.
 *
 * Every call is best-effort: a cache outage must degrade to "slower", never
 * to "down", so failures return null/no-op after logging by the caller.
 */
export class UpstashCache implements CacheStore {
  constructor(
    private url: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async command<T>(cmd: unknown[]): Promise<T | null> {
    try {
      const res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cmd),
        signal: AbortSignal.timeout(2000), // cache slower than 2s is worse than no cache
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { result: T };
      return body.result;
    } catch {
      return null; // fail open: cache errors never break requests
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.command<string | null>(["GET", key]);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.command(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
  }

  async delete(key: string): Promise<void> {
    await this.command(["DEL", key]);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.command<number>(["INCR", key]);
    if (n === null) return 1; // cache down: don't block traffic on the limiter
    if (n === 1) await this.command(["EXPIRE", key, ttlSeconds]);
    return n;
  }
}
