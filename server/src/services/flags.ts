import type { SupabaseClient } from "@supabase/supabase-js";
import type { CacheStore } from "../cache/types";
import { cacheKeys, TTL } from "../cache/types";
import type { Env } from "../config/env";
import {
  DEFAULT_FLAGS,
  type FeatureFlagKey,
  type FeatureFlags,
} from "../../../shared/contracts";

/**
 * Feature flags, resolved in priority order:
 *   1. env override   FLAG_<KEY>=true|false   (ops kill-switch, no deploy)
 *   2. database row   feature_flags           (runtime toggles, admin UI)
 *   3. code default   DEFAULT_FLAGS           (safe baseline)
 * DB reads are cached (60s) so flipping a flag lands quickly without hitting
 * Postgres on every request. Percentage rollouts hash the user id — stable
 * per user, no coordination needed.
 */
export class FlagService {
  constructor(
    private env: Env,
    private cache: CacheStore,
    private db: SupabaseClient | null,
  ) {}

  async all(userId?: string): Promise<FeatureFlags> {
    const dbFlags = await this.dbFlags();
    const result = { ...DEFAULT_FLAGS };
    for (const key of Object.keys(result) as FeatureFlagKey[]) {
      const envOverride = this.envOverride(key);
      if (envOverride !== null) {
        result[key] = envOverride;
        continue;
      }
      const row = dbFlags?.[key];
      if (row) {
        result[key] =
          row.enabled &&
          (row.rollout_pct === null || inRollout(userId, key, row.rollout_pct));
      }
    }
    return result;
  }

  async isEnabled(key: FeatureFlagKey, userId?: string): Promise<boolean> {
    return (await this.all(userId))[key];
  }

  private envOverride(key: FeatureFlagKey): boolean | null {
    const raw = this.env.raw[`FLAG_${key.toUpperCase()}`];
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return null;
  }

  private async dbFlags(): Promise<Record<
    string,
    { enabled: boolean; rollout_pct: number | null }
  > | null> {
    if (!this.db) return null;
    const cached = await this.cache.get<Record<string, { enabled: boolean; rollout_pct: number | null }>>(
      cacheKeys.flags(),
    );
    if (cached) return cached;
    const { data, error } = await this.db
      .from("feature_flags")
      .select("key, enabled, rollout_pct");
    if (error || !data) return null;
    const map: Record<string, { enabled: boolean; rollout_pct: number | null }> = {};
    for (const row of data) map[row.key] = { enabled: row.enabled, rollout_pct: row.rollout_pct };
    await this.cache.set(cacheKeys.flags(), map, TTL.flags);
    return map;
  }
}

/** Deterministic 0-99 bucket from user id + flag key. Anonymous users: out. */
function inRollout(userId: string | undefined, key: string, pct: number): boolean {
  if (!userId) return false;
  let h = 0;
  const s = `${key}:${userId}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100 < pct;
}
