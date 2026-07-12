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

export type SnapshotKind = "teams" | "matches";

export interface Snapshot<T = unknown> {
  kind: SnapshotKind;
  payload: T;
  source: string;
  syncedAt: string;
}

const cacheKey = (kind: SnapshotKind) => `snapshot:v1:${kind}`;
/** Cache TTL is generous — sync jobs overwrite in place; DB holds the durable copy. */
const SNAPSHOT_TTL = 60 * 60 * 24;

export class SnapshotStore {
  constructor(
    private cache: CacheStore,
    private db: SupabaseClient | null,
    private logger: Logger,
  ) {}

  async get<T>(kind: SnapshotKind): Promise<Snapshot<T> | null> {
    const cached = await this.cache.get<Snapshot<T>>(cacheKey(kind));
    if (cached) return cached;

    if (this.db) {
      const { data, error } = await this.db
        .from("catalog_snapshots")
        .select("kind, payload, source, synced_at")
        .eq("kind", kind)
        .maybeSingle();
      if (error) {
        this.logger.warn("snapshot.read_failed", { kind, error: error.message });
        return null;
      }
      if (data) {
        const snap: Snapshot<T> = { kind, payload: data.payload as T, source: data.source, syncedAt: data.synced_at };
        await this.cache.set(cacheKey(kind), snap, SNAPSHOT_TTL);
        return snap;
      }
    }
    return null;
  }

  async set<T>(kind: SnapshotKind, payload: T, source: string): Promise<void> {
    const snap: Snapshot<T> = { kind, payload, source, syncedAt: new Date().toISOString() };
    await this.cache.set(cacheKey(kind), snap, SNAPSHOT_TTL);
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
