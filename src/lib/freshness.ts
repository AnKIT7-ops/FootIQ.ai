import { useSyncExternalStore } from "react";
import type { ApiMeta } from "@shared/contracts";
import { backendConfigured } from "@/lib/config";

/**
 * Data-provenance signal — the API client reports every response's `meta` here
 * (zero extra requests), so the UI can honestly answer "is this live data, and
 * how old is it?".
 *
 * `syncedAt` and `seenAt` are NOT the same thing and the difference matters:
 *
 *   seenAt   — when this browser received a response. Always ~now. Rendering
 *              it as "last updated" would say "just now" forever, including
 *              when the sync has been dead for six hours.
 *   syncedAt — when the sync actually wrote the snapshot from the provider.
 *              This is what "last updated 2 minutes ago" has to mean, and it
 *              is the only one of the two that can reveal a stalled sync.
 */

export type Freshness = {
  source: "provider" | "demo" | "unknown";
  /** When this browser last saw a catalog response. */
  seenAt: string | null;
  /** ISO time the SYNC wrote the data we're looking at. Null until a response carries one. */
  syncedAt: string | null;
};

let state: Freshness = { source: "unknown", seenAt: null, syncedAt: null };
const listeners = new Set<() => void>();

/**
 * Endpoints whose provenance this chip speaks for: the football core.
 *
 * Demo-tier domains (/api/players, /api/news, /api/transfers…) always report
 * `source: "demo"` — that is their permanent, correct answer, and each is
 * labelled on its own page. Letting them feed a single global signal made the
 * chip a race: whichever response landed last won, so the app announced "Demo
 * data" while displaying provider-synced fixtures, real crests and a live
 * league table. The chip answers "is the FOOTBALL data live?", so only the
 * snapshot-backed endpoints get a vote.
 */
const CORE = /^\/api\/(v1\/)?(matches|teams|competitions)(\/|\?|$)/;

/** Called by the API client on every successful response. */
export function noteMeta(meta: ApiMeta | undefined, path?: string): void {
  if (path && !CORE.test(path)) return;
  const source = meta?.source;
  // "database" (user-data rows) says nothing about whether football data is live
  if (source !== "provider" && source !== "demo") return;

  // Keep the freshest sync we've been told about. Endpoints have different
  // cadences (teams 24h, fixtures 30m), so the newest syncedAt is the one that
  // answers "when did FootIQ last hear from the provider".
  const nextSynced =
    meta?.syncedAt && (!state.syncedAt || meta.syncedAt > state.syncedAt) ? meta.syncedAt : state.syncedAt;
  if (source === state.source && nextSynced === state.syncedAt) return;

  state = { source, seenAt: new Date().toISOString(), syncedAt: nextSynced };
  listeners.forEach((l) => l());
}

export function useFreshness(): Freshness {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state,
  );
}

/**
 * The one answer to "live or demo?" — the top-bar chip, the sidebar label and
 * every demo-content gate read this rather than guessing on their own.
 *
 * No backend at all is demo. A backend that hasn't answered yet is "unknown",
 * and demo content stays hidden until it says "demo": in production that
 * answer is "provider", and a demo fixture flashing up first is exactly the
 * contradiction this exists to prevent.
 */
export function dataMode(f: Freshness = state): Freshness["source"] {
  return f.source === "unknown" && !backendConfigured ? "demo" : f.source;
}

/** Demo-only content (bundled fixtures, the generated Intelligence library) may render. */
export const demoContentAllowed = (): boolean => dataMode() === "demo";

export function useDataMode(): Freshness["source"] {
  return dataMode(useFreshness());
}

/**
 * Coarse relative time: "just now", "2m ago", "3h ago", "2d ago".
 *
 * Deliberately coarse — this is a staleness signal, not a clock, and false
 * precision ("1m 47s ago") invites the reader to trust it more than a value
 * refreshed on render deserves.
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 0) return "just now"; // clock skew — never render a future age
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Whole days until an ISO date, floored at 0. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  const midnight = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.max(0, Math.round((midnight(target) - midnight(now.getTime())) / 864e5));
}
