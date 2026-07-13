import { useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";
import { bump } from "@/lib/metrics";
import { track } from "@/lib/analytics";

/**
 * User data store — favorites, bookmarks, prediction history, notification
 * preferences. Local-first: localStorage is the source of truth on this
 * device so everything works signed-out and offline; when a backend is
 * configured each mutation is mirrored best-effort to /api/users/* (the
 * server keeps the authed copy, RLS-scoped).
 */

export type FavoriteKind = "team" | "player";

export interface Bookmark {
  kind: "news" | "intel";
  refId: string;
  title: string;
  path: string;
  savedAt: string;
}

export interface PredictionView {
  matchId: string;
  path: string;
  label: string;
  probs: [number, number, number]; // home/draw/away at view time
  viewedAt: string;
}

export interface NotificationPrefs {
  matchReminders: boolean;
  aiReports: boolean;
  transferUpdates: boolean;
  favoriteTeamNews: boolean;
  weeklyDigest: boolean;
}

interface UserData {
  favorites: Array<{ kind: FavoriteKind; refId: string }>;
  bookmarks: Bookmark[];
  predictionViews: PredictionView[];
  prefs: NotificationPrefs;
}

const KEY = "footiq-user";
const DEFAULT: UserData = {
  favorites: [],
  bookmarks: [],
  predictionViews: [],
  prefs: { matchReminders: true, aiReports: true, transferUpdates: true, favoriteTeamNews: true, weeklyDigest: true },
};

let data: UserData = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as Partial<UserData>;
    return { ...DEFAULT, ...parsed, prefs: { ...DEFAULT.prefs, ...parsed.prefs } };
  } catch {
    return DEFAULT;
  }
})();

const listeners = new Set<() => void>();

function commit(next: UserData): void {
  data = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — in-memory copy still serves the session */
  }
  listeners.forEach((l) => l());
}

/** Fire-and-forget server mirror — the local copy is never blocked on it. */
function mirror(fn: () => Promise<unknown>): void {
  if (!backendConfigured) return;
  void fn().catch(() => {});
}

// ---- favorites ---------------------------------------------------------------

export const isFavorite = (kind: FavoriteKind, refId: string): boolean =>
  data.favorites.some((f) => f.kind === kind && f.refId === refId);

export function toggleFavorite(kind: FavoriteKind, refId: string): boolean {
  const on = !isFavorite(kind, refId);
  commit({
    ...data,
    favorites: on ? [...data.favorites, { kind, refId }] : data.favorites.filter((f) => !(f.kind === kind && f.refId === refId)),
  });
  mirror(() => (on ? api.put("/api/users/favorites", { kind, refId }) : api.delete("/api/users/favorites", { kind, refId })));
  bump("entity_view", `favorite:${kind}:${refId}`);
  track(on ? "favorite_added" : "favorite_removed", { kind, refId });
  return on;
}

export const favoritesOf = (kind: FavoriteKind): string[] =>
  data.favorites.filter((f) => f.kind === kind).map((f) => f.refId);

// ---- bookmarks -----------------------------------------------------------------

export const isBookmarked = (refId: string): boolean => data.bookmarks.some((b) => b.refId === refId);

export function toggleBookmark(b: Omit<Bookmark, "savedAt">): boolean {
  const on = !isBookmarked(b.refId);
  commit({
    ...data,
    bookmarks: on
      ? [{ ...b, savedAt: new Date().toISOString() }, ...data.bookmarks].slice(0, 100)
      : data.bookmarks.filter((x) => x.refId !== b.refId),
  });
  // ponytail: remote bookmark removal needs the server row id — mirror adds only; full sync lands with the auth UI phase
  if (on) {
    mirror(() => api.put("/api/users/bookmarks", { kind: b.kind, refId: b.refId }));
    track("bookmark_added", { kind: b.kind, refId: b.refId });
  }
  return on;
}

// ---- prediction history -----------------------------------------------------------

export function recordPredictionView(v: Omit<PredictionView, "viewedAt">): void {
  if (data.predictionViews[0]?.matchId === v.matchId) return; // collapse repeat views
  track("prediction_viewed", { matchId: v.matchId });
  commit({
    ...data,
    predictionViews: [{ ...v, viewedAt: new Date().toISOString() }, ...data.predictionViews.filter((x) => x.matchId !== v.matchId)].slice(0, 50),
  });
}

// ---- notification preferences ------------------------------------------------------

export function setPref<K extends keyof NotificationPrefs>(key: K, value: boolean): void {
  commit({ ...data, prefs: { ...data.prefs, [key]: value } });
  mirror(() => api.patch("/api/settings", { emailNews: data.prefs.weeklyDigest, emailMatchAlerts: data.prefs.matchReminders }));
}

// ---- reactivity ---------------------------------------------------------------------

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Reactive snapshot — components re-render on any user-data change. */
export function useUserData(): UserData {
  return useSyncExternalStore(subscribe, () => data, () => data);
}
