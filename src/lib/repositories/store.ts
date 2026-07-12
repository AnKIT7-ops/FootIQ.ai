import { useSyncExternalStore } from "react";
import { api, ApiUnavailableError } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";

/**
 * Repository store engine — stale-while-revalidate with a demo seed.
 *
 * Every dataset repository wraps one of these. The store starts SYNCHRONOUSLY
 * populated with bundled demo data (so nothing ever waits or flashes empty),
 * then — only when a backend is configured — refreshes once in the background
 * and swaps the data in. Pages consume either through the module's live
 * bindings (existing sync call sites keep working untouched) or through the
 * `use()` hook (reactive; re-renders on hydration).
 *
 * The frontend never knows where data came from: same shape, same fields,
 * whether it was demo, database, or a future paid provider.
 */

export interface RepoStore<T> {
  get(): T;
  /** React hook — subscribes to hydration swaps. */
  use(): T;
  /** Force a refetch (e.g. pull-to-refresh later). Safe no-op without backend. */
  refresh(): Promise<void>;
  /** Register a callback fired on every data swap (module live bindings use this). */
  onChange(listener: (data: T) => void): void;
}

export function createRepoStore<T>(options: {
  /** For diagnostics only. */
  name: string;
  /** Bundled demo dataset — the permanent fallback. */
  seed: T;
  /** API path that returns the same shape. */
  endpoint: string;
  /** Optional transform if the endpoint's payload isn't exactly T. */
  map?: (payload: unknown) => T;
}): RepoStore<T> {
  let data = options.seed;
  const listeners = new Set<() => void>();
  const changeListeners = new Set<(d: T) => void>();
  let fetchStarted = false;

  const swap = (next: T) => {
    data = next;
    changeListeners.forEach((l) => l(next));
    listeners.forEach((l) => l());
  };

  const refresh = async (): Promise<void> => {
    if (!backendConfigured) return;
    try {
      const payload = await api.get<unknown>(options.endpoint);
      swap(options.map ? options.map(payload) : (payload as T));
    } catch (err) {
      // Unavailable backend is the designed fallback path — demo data stands.
      // Anything else is unexpected and worth a console note in dev.
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

  return {
    get: () => data,
    use: () =>
      useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => data,
        () => data,
      ),
    refresh,
    onChange: (listener) => {
      changeListeners.add(listener);
    },
  };
}
