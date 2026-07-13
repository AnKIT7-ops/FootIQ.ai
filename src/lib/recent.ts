import { useSyncExternalStore } from "react";

/**
 * Recently-viewed store — a small localStorage ring buffer behind the
 * homepage personalization rows ("Recently viewed", "Because you viewed…").
 * Pages record a view when their entity resolves; dedupe is by path.
 */

export interface RecentItem {
  kind: "player" | "team" | "match" | "news" | "intel";
  id: string;
  label: string;
  sub: string;
  path: string;
  at: string;
}

const KEY = "footiq-recent";
const MAX = 24;

let items: RecentItem[] = (() => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
})();

const listeners = new Set<() => void>();

export function recordView(item: Omit<RecentItem, "at">): void {
  if (items[0]?.path === item.path) return; // refresh/re-render of the same page
  items = [{ ...item, at: new Date().toISOString() }, ...items.filter((x) => x.path !== item.path)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* best-effort */
  }
  listeners.forEach((l) => l());
}

export function recentViews(kinds?: RecentItem["kind"][], n = 8): RecentItem[] {
  const pool = kinds ? items.filter((i) => kinds.includes(i.kind)) : items;
  return pool.slice(0, n);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Reactive snapshot for components (returns the full ring, newest first). */
export function useRecentViews(): RecentItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}
