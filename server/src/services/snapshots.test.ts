import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemoryCache } from "../cache/memory";
import { createLogger } from "../lib/logger";
import { SnapshotStore } from "./snapshots";

/** One catalog_snapshots row, shared the way every isolate shares the real table. */
function fakeDb() {
  const rows = new Map<string, { kind: string; payload: unknown; source: string; synced_at: string }>();
  let failing = false;
  const db = {
    fail: (on: boolean) => { failing = on; },
    from: () => ({
      select: () => ({
        eq: (_col: string, kind: string) => ({
          maybeSingle: async () =>
            failing ? { data: null, error: { message: "db down" } } : { data: rows.get(kind) ?? null, error: null },
        }),
      }),
      upsert: async (row: { kind: string; payload: unknown; source: string; synced_at: string }) => {
        rows.set(row.kind, row);
        return { error: null };
      },
    }),
  };
  return db as unknown as SupabaseClient & { fail: (on: boolean) => void };
}

const logger = createLogger("error");

describe("SnapshotStore", () => {
  afterEach(() => vi.useRealTimers());

  it("does not let one isolate serve a snapshot another isolate's sync replaced", async () => {
    // Production, 2026-09-17: the cron ran in ONE Workers isolate; the others
    // held the previous snapshot in per-isolate memory for a 24h TTL, so 11 of
    // 12 requests served a 30-minute-old snapshot that still had a stuck match live.
    vi.useFakeTimers();
    const db = fakeDb();
    const cronIsolate = new SnapshotStore(new MemoryCache(), db, logger);
    const readerIsolate = new SnapshotStore(new MemoryCache(), db, logger);

    await cronIsolate.set("matches", { v: "old" }, "provider");
    expect((await readerIsolate.get<{ v: string }>("matches"))?.payload.v).toBe("old"); // now cached in the reader

    await cronIsolate.set("matches", { v: "new" }, "provider");
    vi.advanceTimersByTime(2 * 60_000);
    expect((await readerIsolate.get<{ v: string }>("matches"))?.payload.v).toBe("new");
  });

  it("serves this isolate's last snapshot when the database read fails", async () => {
    // The 24h TTL used to hide a Supabase outage; the short one must not turn
    // a blip into a 503.
    vi.useFakeTimers();
    const db = fakeDb();
    const store = new SnapshotStore(new MemoryCache(), db, logger);
    await store.set("matches", { v: "last" }, "provider");
    expect((await store.get<{ v: string }>("matches"))?.payload.v).toBe("last");

    db.fail(true);
    vi.advanceTimersByTime(2 * 60_000);
    expect((await store.get<{ v: string }>("matches"))?.payload.v).toBe("last");
  });

  it("keeps the snapshot when memory is the only store (no database)", async () => {
    vi.useFakeTimers();
    const store = new SnapshotStore(new MemoryCache(), null, logger);
    await store.set("matches", { v: "only" }, "provider");
    vi.advanceTimersByTime(60 * 60_000); // an hour: a sync interval twice over
    expect((await store.get<{ v: string }>("matches"))?.payload.v).toBe("only");
  });
});
