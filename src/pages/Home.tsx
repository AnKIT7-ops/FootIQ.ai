import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";
import { Crest } from "@/components/ui/Crest";
import { MatchCard } from "@/components/ui/MatchCard";
import { DataState } from "@/components/ui/DataState";
import { useMatchesState } from "@/lib/repositories/matches";
import { getTeam, useTeams } from "@/lib/repositories/teams";
import { teamPathFor } from "@/lib/slug-builders";
import { usePageMeta } from "@/lib/seo";
import { legalEntries } from "@/lib/nav";
import { searchTeams } from "@/lib/team-search";
import type { Match, Team } from "@/data/types";

const newestFirst = (a: Match, b: Match) => b.kickoffIso.localeCompare(a.kickoffIso);

export default function Home() {
  usePageMeta({
    title: "Recent results",
    description: "Search any club in Europe's top leagues and the Champions League and see its latest results on FootIQ.",
    path: "/",
  });
  const teams = useTeams();
  const { data: matchData, status } = useMatchesState();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const teamId = params.get("team");
  const team = teamId ? getTeam(teamId) : null;
  const suggestions = useMemo(() => searchTeams(teams, query), [teams, query]);

  // Unconfirmed = kicked off, provider never confirmed the score; MatchCard labels it.
  const played = useMemo(
    () => [...matchData.finished, ...matchData.unconfirmed].sort(newestFirst),
    [matchData.finished, matchData.unconfirmed],
  );
  const shown = team ? played.filter((m) => m.homeId === team.id || m.awayId === team.id).slice(0, 10) : played.slice(0, 12);

  const pick = (t: Team) => {
    setParams({ team: t.id });
    setQuery("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section aria-label="Find a team">
        <h1 className="display text-2xl font-black text-ink">Recent results</h1>
        <form
          role="search"
          className="relative mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (suggestions[0]) pick(suggestions[0]);
          }}
        >
          <label htmlFor="team-search" className="sr-only">
            Search a club
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            id="team-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search a club: Ajax, Benfica, Arsenal…"
            className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-4 text-prose text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </form>

        {query.trim() && (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Matching clubs">
            {suggestions.length === 0 ? (
              <li className="p-3.5 text-ui text-ink-3">No club matches "{query.trim()}".</li>
            ) : (
              suggestions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pick(t)}
                    className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <Crest teamId={t.id} size={24} />
                    <span className="truncate text-ui font-semibold text-ink">{t.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-micro uppercase tracking-wider text-ink-3">{t.league}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section aria-label={team ? `${team.name} results` : "Latest results"}>
        {team ? (
          <div className="mb-4 flex items-center gap-3">
            <Crest teamId={team.id} size={40} />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-ink">{team.name}</h2>
              <p className="text-caption text-ink-3">{team.league}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Link
                to={teamPathFor(team)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-caption font-semibold text-accent-ink hover:bg-surface-2"
              >
                Team page <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => setParams({})}
                aria-label="Show all latest results"
                className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          <h2 className="mb-4 text-lg font-bold text-ink">Latest</h2>
        )}

        {shown.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((m) => (
              <MatchCard key={m.id} match={m} dense />
            ))}
          </div>
        )}
        <DataState
          status={status}
          empty={shown.length === 0}
          loadingLabel="Loading results…"
          emptyTitle={team ? `No recent results for ${team.short}` : "No recent results"}
          emptyBody="FootIQ keeps the last five weeks of results. Anything older isn't in the feed."
        />
      </section>

      <footer className="border-t border-line pt-6" aria-label="Site footer">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalEntries.map((l) => (
              <Link key={l.to} to={l.to} className="font-mono text-micro uppercase tracking-wider text-ink-3 transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="max-w-2xl text-label leading-relaxed text-ink-3">
            Results from football-data.org. Predictions and insights elsewhere on FootIQ are informational only, never betting advice. © 2026 FootIQ.
          </p>
        </div>
      </footer>
    </div>
  );
}
