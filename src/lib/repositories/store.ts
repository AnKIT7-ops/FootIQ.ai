import { useSyncExternalStore } from "react";
import { api, ApiUnavailableError } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";

/**
 * Repository store engine — stale-while-revalidate with an optional seed.
 *
 * Every dataset repository wraps one of these. The store starts SYNCHRONOUSLY
 * populated with its seed, then — only when a backend is configured —
 * refreshes once in the background and swaps the data in. Pages consume either
 * through the module's live bindings (existing sync call sites keep working
 * untouched) or through the `use()` hook (reactive; re-renders on hydration).
 *
 * Two kinds of repository use this, and the difference is the seed:
 *
 *   DEMO-TIER (players, news, fantasy…): seeded with bundled demo data that is
 *   honest about being demo. It is the answer, not a placeholder.
 *
 *   LIVE-TIER (matches, teams): seeded EMPTY. Real football has no offline
 *   answer — inventing one is how a permanently-live 67th-minute fixture ends
 *   up on screen during the off-season. These start empty and expose `status`
 *   so the UI can say "loading", "no live matches", or "unavailable" instead of
 *   filling the silence with fiction.
 *
 * `status` is what makes the difference expressible. Without it every failure
 * looks like an empty success, and the only way to avoid a blank screen is to
 * lie.
 */

/** loading: fetch in flight · ready: backend answered · unavailable: no backend configured · error: backend failed. */
export type RepoStatus = "loading" | "ready" | "unavailable" | "error";

export interface RepoState<T> {
  data: T;
  status: RepoStatus;
}

export interface RepoStore<T> {
  get(): T;
  state(): RepoState<T>;
  /** React hook — subscribes to hydration swaps. */
  use(): T;
  /** React hook — data plus load status, for UI that must distinguish empty from failed. */
  useState(): RepoState<T>;
  /** Force a refetch (e.g. pull-to-refresh later). Safe no-op without backend. */
  refresh(): Promise<void>;
  /** Register a callback fired on every data swap (module live bindings use this). */
  onChange(listener: (data: T) => void): void;
}

export function createRepoStore<T>(options: {
  /** For diagnostics only. */
  name: string;
  /** Starting dataset — bundled demo data, or an empty value for live-tier domains. */
  seed: T;
  /** API path that returns the same shape. */
  endpoint: string;
  /** Optional transform if the endpoint's payload isn't exactly T. */
  map?: (payload: unknown) => T;
}): RepoStore<T> {
  let data = options.seed;
  let status: RepoStatus = backendConfigured ? "loading" : "unavailable";
  const listeners = new Set<() => void>();
  const changeListeners = new Set<(d: T) => void>();
  let fetchStarted = false;
  // useSyncExternalStore compares by reference: a fresh object per call is an
  // infinite re-render. Rebuild only on real change.
  let snapshot: RepoState<T> = { data, status };

  const publish = () => {
    snapshot = { data, status };
    listeners.forEach((l) => l());
  };

  const swap = (next: T) => {
    data = next;
    status = "ready";
    changeListeners.forEach((l) => l(next));
    publish();
  };

  const refresh = async (): Promise<void> => {
    if (!backendConfigured) {
      status = "unavailable";
      publish();
      return;
    }
    try {
      const payload = await api.get<unknown>(options.endpoint);
      swap(options.map ? options.map(payload) : (payload as T));
    } catch (err) {
      // The backend is the only source of truth for live-tier data. A failure
      // is reported as a failure — never papered over with the seed, which for
      // live-tier repos is empty anyway.
      status = err instanceof ApiUnavailableError ? "unavailable" : "error";
      publish();
      if (!(err instanceof ApiUnavailableError) && import.meta.env.DEV) {
        console.warn(`[repo:${options.name}] refresh failed`, err);
      }
    }
  };

  // Kick off exactly one background hydration per session, at module load —
  // i.e. when the first page that needs this dataset gets its chunk.
  const ensureFetch = () => {
    if (fetchStarted) return;
    fetchStarted = true;
    void refresh();
  };
  ensureFetch();

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };

  return {
    get: () => data,
    state: () => snapshot,
    use: () => useSyncExternalStore(subscribe, () => data, () => data),
    useState: () => useSyncExternalStore(subscribe, () => snapshot, () => snapshot),
    refresh,
    onChange: (listener) => {
      changeListeners.add(listener);
    },
  };
}
