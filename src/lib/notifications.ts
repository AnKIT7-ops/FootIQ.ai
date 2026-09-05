import { useSyncExternalStore } from "react";
import { upcomingMatches } from "@/lib/repositories/matches";
import { news } from "@/lib/repositories/news";
import { transferRumors } from "@/lib/repositories/transfers";
import { getTeam } from "@/lib/repositories/teams";
import { getPlayer } from "@/lib/repositories/players";
import { contentLibrary } from "@/lib/repositories/content";
import { favoritesOf, useUserData } from "@/lib/user";
import { matchPathFor, newsPathFor } from "@/lib/slug-builders";
import { teams } from "@/lib/repositories/teams";
import { kickoffLabel } from "@/lib/kickoff";

/**
 * Notification feed — derived deterministically from what the user follows:
 * match reminders, breaking news, transfer moves and fresh AI reports for
 * favorited teams/players. Read-state lives in localStorage. On a configured
 * deployment the server's /api/notifications inbox (email/push later) merges
 * on top of this local feed — same shape, same panel.
 */

export type NotificationKind = "match" | "news" | "transfer" | "ai-report" | "digest";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  path: string;
}

const READ_KEY = "footiq-notifications-read";

function readIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

const listeners = new Set<() => void>();
let readSnapshot = readIds();

export function markRead(ids: string[]): void {
  for (const id of ids) readSnapshot.add(id);
  readSnapshot = new Set(readSnapshot);
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...readSnapshot].slice(-400)));
  } catch {
    /* best-effort */
  }
  listeners.forEach((l) => l());
}

/** Build the feed for the current follow set (capped, deterministic order). */
export function buildNotifications(prefs: { matchReminders: boolean; favoriteTeamNews: boolean; transferUpdates: boolean; aiReports: boolean }): AppNotification[] {
  const favTeams = new Set(favoritesOf("team"));
  const favPlayers = new Set(favoritesOf("player"));
  const out: AppNotification[] = [];

  if (prefs.matchReminders) {
    for (const m of upcomingMatches) {
      if (favTeams.has(m.homeId) || favTeams.has(m.awayId)) {
        const home = getTeam(m.homeId);
        const away = getTeam(m.awayId);
        out.push({
          id: `match-${m.id}`,
          kind: "match",
          title: `${home.short} vs ${away.short} — ${kickoffLabel(m.kickoffIso)}`,
          body: `${m.competition} at ${m.venue}. Model preview is ready.`,
          path: matchPathFor(m, teams),
        });
      }
    }
  }

  if (prefs.favoriteTeamNews) {
    for (const n of news) {
      if (n.teamIds.some((t) => favTeams.has(t)) || n.playerIds.some((p) => favPlayers.has(p))) {
        out.push({
          id: `news-${n.id}`,
          kind: "news",
          title: n.title,
          body: n.aiSummary[0] ?? n.category,
          path: newsPathFor(n),
        });
      }
    }
  }

  if (prefs.transferUpdates) {
    for (const r of transferRumors) {
      if (favPlayers.has(r.playerId) || favTeams.has(r.fromId) || favTeams.has(r.toId)) {
        const p = getPlayer(r.playerId);
        out.push({
          id: `transfer-${r.id}`,
          kind: "transfer",
          title: `${p.name} → ${getTeam(r.toId).short}: ${r.probability}%`,
          body: `${r.stage} · trend ${r.trend}.`,
          path: "/transfers",
        });
      }
    }
  }

  if (prefs.aiReports) {
    const favPlayerNames = [...favPlayers].map((id) => getPlayer(id).name);
    const favTeamNames = [...favTeams].map((id) => getTeam(id).name);
    for (const a of contentLibrary()) {
      if (a.tags.some((t) => favPlayerNames.includes(t) || favTeamNames.includes(t))) {
        out.push({
          id: `intel-${a.slug}`,
          kind: "ai-report",
          title: a.title,
          body: a.dek,
          path: `/intelligence/${a.slug}`,
        });
      }
    }
  }

  return out.slice(0, 30);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Reactive notification feed + read state for the bell/panel. */
export function useNotifications(): { items: Array<AppNotification & { read: boolean }>; unread: number; markRead: typeof markRead } {
  const user = useUserData(); // re-derive when follows/prefs change
  const readSet = useSyncExternalStore(subscribe, () => readSnapshot, () => readSnapshot);
  const items = buildNotifications(user.prefs).map((n) => ({ ...n, read: readSet.has(n.id) }));
  return { items, unread: items.filter((n) => !n.read).length, markRead };
}
