import type { SupabaseClient } from "@supabase/supabase-js";
import type { CacheStore } from "../cache/types";
import { cacheKeys } from "../cache/types";

/**
 * Per-user daily usage metering. Postgres RPC (atomic, durable) when the DB
 * is configured; cache counter otherwise (good enough for demo mode — resets
 * on restart, which only ever errs in the user's favor).
 */
export class QuotaService {
  constructor(
    private db: SupabaseClient | null,
    private cache: CacheStore,
  ) {}

  /** Try to spend one unit. False = over limit. */
  async consume(userId: string, metric: string, limit: number): Promise<boolean> {
    if (this.db) {
      const { data, error } = await this.db.rpc("increment_quota", {
        p_user: userId,
        p_metric: metric,
        p_limit: limit,
      });
      // fail closed on DB errors for metered (paid-adjacent) resources
      if (error) return false;
      return typeof data === "number" && data !== -1;
    }
    const day = new Date().toISOString().slice(0, 10);
    const used = await this.cache.increment(cacheKeys.quota(userId, metric, day), 60 * 60 * 26);
    return used <= limit;
  }
}
