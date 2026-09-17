import type { SupabaseClient } from "@supabase/supabase-js";
import type { CacheStore } from "../cache/types";
import type { Logger } from "../lib/logger";

/**
 * Snapshot store — the persistence stage of the data pipeline.
 *
 *   read:  cache → database → null (caller falls back to demo)
 *   write: cache + database (each best-effort, independent)
 *
 * One generic JSONB row per snapshot kind keeps the schema out of the way
 * while sources are still settling.
 * ponytail: single-table JSONB snapshots; relational catalog tables when
 * per-entity queries (not whole-collection reads) become the access pattern.
 */

/**
 * `team_identity` holds the provider's raw club metadata (crest, venue,
 * founded, colours) separately from `teams` (the merged catalog).
 *
 * They are separate because the standings sync REBUILDS `teams` from scratch
 * every 30 minutes, while identity is only re-fetched every 24h. Storing them
 * together meant each standings pass wiped the enrichment until the next daily
 * fetch — clubs would lose their crests for 23 hours out of 24. Keeping the raw
 * identity lets every standings pass re-apply it from cache, no network.
 */
export type SnapshotKind = "teams" | "matches" | "competitions" | "team_identity";

export interface Snapshot<T = unknown> {
  kind: SnapshotKind;
  payload: T;
  source: string;
  syncedAt: string;
}

const cacheKey = (kind: SnapshotKind) => `snapshot:v1:${kind}`;
/**
 * With no database, the cache IS the store: keep it for a day.
 *
 * With a database, the cache is a read-through copy, and on Workers without a
 * shared KV/Upstash back it is per-isolate memory. A sync only overwrites the
 * copy in the isolate the cron ran in; every other isolate keeps what it has
 * until the TTL runs out. At 24h that served a 30-minute-old snapshot on 11 of
 * 12 requests (2026-09-17). 30s matches TieredCache's front, bounding
 * cross-isolate staleness for one single-row DB read per isolate per 30s.
 */
const STORE_TTL = 60 * 60 * 24;
const READ_THROUGH_TTL = 30;

export class SnapshotStore {
  constructor(
    private cache: CacheStore,
    private db: SupabaseClient | null,
    private logger: Logger,
  ) {}

  /**
   * Last snapshot this isolate saw, served only when the DB read fails. The
   * short TTL means a Supabase blip would otherwise 503 within 30s; the 24h
   * TTL used to mask that. It carries its own syncedAt, so the freshness chip
   * still shows how old it is.
   */
  private lastGood = new Map<SnapshotKind, Snapshot>();

  private get ttl(): number {
    return this.db ? READ_THROUGH_TTL : STORE_TTL;
  }

  async get<T>(kind: SnapshotKind): Promise<Snapshot<T> | null> {
    const cached = await this.cache.get<Snapshot<T>>(cacheKey(kind));
    if (cached) {
      this.lastGood.set(kind, cached);
      return cached;
    }

    if (this.db) {
      const { data, error } = await this.db
        .from("catalog_snapshots")
        .select("kind, payload, source, synced_at")
        .eq("kind", kind)
        .maybeSingle();
      if (error) {
        this.logger.warn("snapshot.read_failed", { kind, error: error.message });
        return (this.lastGood.get(kind) as Snapshot<T> | undefined) ?? null;
      }
      if (data) {
        const snap: Snapshot<T> = { kind, payload: data.payload as T, source: data.source, syncedAt: data.synced_at };
        await this.cache.set(cacheKey(kind), snap, this.ttl);
        this.lastGood.set(kind, snap);
        return snap;
      }
    }
    return null;
  }

  async set<T>(kind: SnapshotKind, payload: T, source: string): Promise<void> {
    const snap: Snapshot<T> = { kind, payload, source, syncedAt: new Date().toISOString() };
    await this.cache.set(cacheKey(kind), snap, this.ttl);
    if (this.db) {
      const { error } = await this.db
        .from("catalog_snapshots")
        .upsert({ kind, payload, source, synced_at: snap.syncedAt }, { onConflict: "kind" });
      if (error) this.logger.warn("snapshot.write_failed", { kind, error: error.message });
    }
  }

  async invalidate(kind: SnapshotKind): Promise<void> {
    await this.cache.delete(cacheKey(kind));
  }
}
