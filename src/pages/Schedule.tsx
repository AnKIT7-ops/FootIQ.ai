import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { MatchCard } from "@/components/ui/MatchCard";
import { DataState } from "@/components/ui/DataState";
import { SeasonStatus } from "@/components/ui/SeasonStatus";
import { useMatchesState } from "@/lib/repositories/matches";
import { nextSeasonStart, useCompetitions } from "@/lib/repositories/competitions";
import { dayOffset, isThisWeek, isToday, isTomorrow, kickoffDayHeading, kickoffDayKey } from "@/lib/kickoff";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";
import type { Match } from "@/data/types";
import type { CompetitionDto } from "@shared/contracts";

type Range = "today" | "tomorrow" | "week" | "all" | "live" | "completed";

/**
 * "All upcoming" is not padding. Between seasons the next fixture can be five
 * weeks out, so Today/Tomorrow/This Week are all legitimately empty while the
 * sync holds ~200 real fixtures — without this range they are unreachable and
 * the page looks broken rather than out of season.
 */
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All upcoming" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
];

const EMPTY_COPY: Record<Range, { title: string; body: string }> = {
  today: { title: "No matches today", body: "Nothing is scheduled today in the competitions we follow." },
  tomorrow: { title: "No matches tomorrow", body: "Nothing is scheduled tomorrow in the competitions we follow." },
  week: { title: "No matches this week", body: "Nothing is scheduled in the next seven days — common between seasons." },
  all: { title: "No upcoming fixtures", body: "No fixtures are published in the window we sync." },
  live: { title: "No live matches", body: "Nothing is being played right now." },
  completed: { title: "No recent results", body: "No matches have finished in the window we sync." },
};

/**
 * "No matches today" is true in mid-July but useless — it reads like a fault.
 * When nothing has kicked off yet, say when it does and where the fixtures are;
 * the season dates are real provider data, so this replaces a shrug with a fact.
 */
function offSeasonBody(next: CompetitionDto | null, fallback: string, nextKickoffIso: string | null): string {
  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  // Only point at a tab that actually has something in it.
  const where = nextKickoffIso ? " All upcoming has the published fixtures." : "";
  if (next?.season) return `The ${next.name} season starts on ${day(next.season.startDateIso)}.${where}`;
  // Mid-season gaps are real too — the merged Sep–Oct FIFA window is 16 days
  // with no league football. Name the next kickoff instead of blaming "between seasons".
  if (nextKickoffIso) return `The next fixture is on ${day(nextKickoffIso)}.${where}`;
  return fallback;
}

/**
 * Schedule — fixtures by date, filterable by competition.
 *
 * Every match here is provider-synced and carries an ISO kickoff, so bucketing
 * is done against the reader's local calendar rather than a baked display
 * string. Postponed and cancelled fixtures keep their place in the day they
 * were scheduled for; MatchCard labels them instead of showing a score.
 */
export default function Schedule() {
  usePageMeta(staticPageMeta["/schedule"]);

  const { data, status } = useMatchesState();
  const comps = useCompetitions();
  const [picked, setRange] = useState<Range | null>(null);
  const [competition, setCompetition] = useState<string>("all");

  const scheduled = useMemo(
    () => [...data.upcoming, ...data.postponed, ...data.cancelled],
    [data.upcoming, data.postponed, data.cancelled],
  );

  const nextKickoffIso = useMemo(
    () => data.upcoming.reduce<string | null>((min, m) => (!min || m.kickoffIso < min ? m.kickoffIso : min), null),
    [data.upcoming],
  );

  // Until the reader picks a tab, land on the first one with fixtures in it —
  // during a break Today and This Week are empty and the page reads as broken.
  const range: Range =
    picked ??
    (!scheduled.length || scheduled.some((m) => isToday(m.kickoffIso))
      ? "today"
      : data.live.length
        ? "live"
        : scheduled.some((m) => isThisWeek(m.kickoffIso))
          ? "week"
          : "all");

  const competitions = useMemo(() => {
    const all = [...scheduled, ...data.live, ...data.finished, ...data.unconfirmed].map((m) => m.competition);
    return [...new Set(all)].sort();
  }, [scheduled, data.live, data.finished, data.unconfirmed]);

  const list = useMemo(() => {
    const byRange: Match[] =
      range === "live"
        ? data.live
        : range === "completed"
          ? [...data.unconfirmed, ...data.finished]
          : range === "today"
            ? scheduled.filter((m) => isToday(m.kickoffIso))
            : range === "tomorrow"
              ? scheduled.filter((m) => isTomorrow(m.kickoffIso))
              : range === "week"
                ? scheduled.filter((m) => isThisWeek(m.kickoffIso))
                : scheduled;
    return competition === "all" ? byRange : byRange.filter((m) => m.competition === competition);
  }, [range, competition, scheduled, data.live, data.finished, data.unconfirmed]);

  /** Day-bucketed for every range except Live, which is one flat "now" list. */
  const days = useMemo(() => {
    if (range === "live") return [];
    const groups = new Map<string, Match[]>();
    for (const m of list) {
      const key = kickoffDayKey(m.kickoffIso);
      const bucket = groups.get(key);
      if (bucket) bucket.push(m);
      else groups.set(key, [m]);
    }
    return [...groups.entries()].sort((a, b) =>
      range === "completed" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]),
    );
  }, [list, range]);

  // A competition filter that hides everything is the user's own doing, not a
  // data problem — say so rather than blaming the feed.
  const filteredToNothing = competition !== "all" && list.length === 0 && status === "ready";

  return (
    <div>
      <SectionHeader
        level={1}
        eyebrow="Fixtures"
        title="Schedule"
        action={<Tabs id="schedule-range" tabs={RANGES} active={range} onChange={(v) => setRange(v as Range)} />}
      />

      {/* Season state per competition — no extra request; it rides on the
          competitions snapshot. Answers "why is this page empty?" before the
          reader has to ask. */}
      <SeasonStatus competitions={comps} className="mb-4" />

      {competitions.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filter by competition">
          {["all", ...competitions].map((c) => (
            <button
              key={c}
              onClick={() => setCompetition(c)}
              aria-pressed={competition === c}
              className={
                competition === c
                  ? "shrink-0 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-caption font-semibold text-accent-ink"
                  : "shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-caption font-semibold text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
              }
            >
              {c === "all" ? "All competitions" : c}
            </button>
          ))}
        </div>
      )}

      {range === "live" && list.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      {range !== "live" &&
        days.map(([key, dayMatches]) => (
          <section key={key} className="mb-7" aria-label={kickoffDayHeading(dayMatches[0].kickoffIso)}>
            <div className="mb-2.5 flex items-baseline gap-2 border-b border-line pb-2">
              <h2 className="text-ui font-semibold text-ink">{kickoffDayHeading(dayMatches[0].kickoffIso)}</h2>
              <span className="font-mono text-micro text-ink-3">
                {dayMatches.length} {dayMatches.length === 1 ? "match" : "matches"}
              </span>
              {Math.abs(dayOffset(dayMatches[0].kickoffIso)) > 6 && (
                <span className="ml-auto font-mono text-micro uppercase tracking-wider text-ink-3">
                  {new Date(dayMatches[0].kickoffIso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dayMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}

      {filteredToNothing ? (
        <DataState
          status={status}
          empty
          emptyTitle={`Nothing for ${competition}`}
          emptyBody="No matches for this competition in the selected range. Try another competition or a wider range."
        />
      ) : (
        <DataState
          status={status}
          empty={list.length === 0}
          emptyTitle={EMPTY_COPY[range].title}
          emptyBody={
            range === "today" || range === "tomorrow" || range === "week"
              ? offSeasonBody(nextSeasonStart(comps), EMPTY_COPY[range].body, nextKickoffIso)
              : EMPTY_COPY[range].body
          }
        />
      )}
    </div>
  );
}
