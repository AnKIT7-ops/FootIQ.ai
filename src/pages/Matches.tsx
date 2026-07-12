import { useState } from "react";
import { SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { MatchCard } from "@/components/ui/MatchCard";
import { liveMatches, upcomingMatches, finishedMatches } from "@/lib/repositories/matches";
import { usePageMeta } from "@/lib/seo";

export default function Matches() {
  usePageMeta({
    title: "Matches",
    description: "Live, upcoming and finished matches with expected goals, momentum and AI match reads.",
    path: "/matches",
  });
  const [tab, setTab] = useState("live");
  const list = tab === "live" ? liveMatches : tab === "upcoming" ? upcomingMatches : finishedMatches;

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
              { value: "live", label: `Live (${liveMatches.length})` },
              { value: "upcoming", label: "Upcoming" },
              { value: "finished", label: "Results" },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
      {list.length === 0 && <p className="mt-10 text-center text-sm text-ink-3">Nothing here right now — check another tab.</p>}
    </div>
  );
}
