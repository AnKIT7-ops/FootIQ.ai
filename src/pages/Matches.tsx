import { useState } from "react";
import { SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { MatchCard } from "@/components/ui/MatchCard";
import { DataState } from "@/components/ui/DataState";
import { useMatchesState } from "@/lib/repositories/matches";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";

export default function Matches() {
  usePageMeta(staticPageMeta["/matches"]);
  const [tab, setTab] = useState("live");
  // Reactive on purpose: this page reads the store through the hook rather than
  // the module's live bindings. Fixtures now arrive asynchronously and start
  // empty, so a non-reactive read renders a blank page forever.
  const { data, status } = useMatchesState();

  const list = tab === "live" ? data.live : tab === "upcoming" ? data.upcoming : [...data.unconfirmed, ...data.finished];
  const ready = status === "ready";

  const emptyCopy = {
    live: {
      title: "No live matches",
      body: ready && data.upcoming.length > 0
        ? "Nothing is being played right now. The Upcoming tab has the next scheduled fixtures."
        : "Nothing is being played right now.",
    },
    upcoming: { title: "No upcoming fixtures", body: "No matches are scheduled in the sync window for the competitions we follow." },
    finished: { title: "No recent results", body: "No completed matches in the sync window yet — results appear here once played." },
  }[tab as "live" | "upcoming" | "finished"];

  return (
    <div>
      <SectionHeader
        level={1}
        eyebrow="Match Center"
        title="Matches"
        action={
          <Tabs
            id="matches"
            tabs={[
              // Counts only once the data is real — "Live (0)" while still
              // loading reads as a claim that nothing is on.
              { value: "live", label: ready ? `Live (${data.live.length})` : "Live" },
              { value: "upcoming", label: "Upcoming" },
              { value: "finished", label: "Results" },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />
      {list.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
      <DataState status={status} empty={list.length === 0} emptyTitle={emptyCopy.title} emptyBody={emptyCopy.body} />
    </div>
  );
}
