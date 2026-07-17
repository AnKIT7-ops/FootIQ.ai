import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { MatchCard } from "@/components/ui/MatchCard";
import { DataState } from "@/components/ui/DataState";
import { useMatchesState } from "@/lib/repositories/matches";
import { dayOffset, isThisWeek, isToday, isTomorrow, kickoffDayHeading, kickoffDayKey } from "@/lib/kickoff";
import { usePageMeta } from "@/lib/seo";
import type { Match } from "@/data/types";

type Range = "today" | "tomorrow" | "week" | "live" | "completed";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This Week" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
];

const EMPTY_COPY: Record<Range, { title: string; body: string }> = {
  today: { title: "No matches today", body: "Nothing is scheduled today in the competitions we follow. Try This Week for the next fixtures." },
  tomorrow: { title: "No matches tomorrow", body: "Nothing is scheduled tomorrow in the competitions we follow." },
  week: { title: "No matches this week", body: "Nothing is scheduled in the next seven days — common between seasons. Fixtures appear here as soon as they're published." },
  live: { title: "No live matches", body: "Nothing is being played right now." },
  completed: { title: "No recent results", body: "No matches have finished in the window we sync." },
};

/**
 * Schedule — fixtures by date, filterable by competition.
 *
 * Every match here is provider-synced and carries an ISO kickoff, so bucketing
 * is done against the reader's local calendar rather than a baked display
 * string. Postponed and cancelled fixtures keep their place in the day they
 * were scheduled for; MatchCard labels them instead of showing a score.
 */
export default function Schedule() {
  usePageMeta({
    title: "Schedule",
    description: "Football fixtures by date — today, tomorrow and the week ahead across Europe's major competitions, with live scores and results.",
    path: "/schedule",
  });

  const { data, status } = useMatchesState();
  const [range, setRange] = useState<Range>("today");
  const [competition, setCompetition] = useState<string>("all");

  const scheduled = useMemo(
    () => [...data.upcoming, ...data.postponed, ...data.cancelled],
    [data.upcoming, data.postponed, data.cancelled],
  );

  const competitions = useMemo(() => {
    const all = [...scheduled, ...data.live, ...data.finished].map((m) => m.competition);
    return [...new Set(all)].sort();
  }, [scheduled, data.live, data.finished]);

  const list = useMemo(() => {
    const byRange: Match[] =
      range === "live"
        ? data.live
        : range === "completed"
          ? data.finished
          : range === "today"
            ? scheduled.filter((m) => isToday(m.kickoffIso))
            : range === "tomorrow"
              ? scheduled.filter((m) => isTomorrow(m.kickoffIso))
              : scheduled.filter((m) => isThisWeek(m.kickoffIso));
    return competition === "all" ? byRange : byRange.filter((m) => m.competition === competition);
  }, [range, competition, scheduled, data.live, data.finished]);

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
        <DataState status={status} empty={list.length === 0} emptyTitle={EMPTY_COPY[range].title} emptyBody={EMPTY_COPY[range].body} />
      )}
    </div>
  );
}
