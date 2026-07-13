import { useSyncExternalStore } from "react";
import type { ApiMeta } from "@shared/contracts";

/**
 * Data-provenance signal — the API client reports every response's
 * `meta.source` here (zero extra requests), so the UI can honestly answer
 * "is this live data or the demo dataset?". Unknown until the first catalog
 * response lands; stays "demo" when no backend is configured.
 */

export type Freshness = { source: "provider" | "demo" | "unknown"; seenAt: string | null };

let state: Freshness = { source: "unknown", seenAt: null };
const listeners = new Set<() => void>();

/** Called by the API client on every successful response. */
export function noteMeta(meta: ApiMeta | undefined): void {
  const source = meta?.source;
  // only catalog provenance matters here — "database" (user-data rows) says
  // nothing about whether football data is live
  if (source !== "provider" && source !== "demo") return;
  if (source === state.source) return;
  state = { source, seenAt: new Date().toISOString() };
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
