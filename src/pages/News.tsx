import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DataState } from "@/components/ui/DataState";
import { HeadlineCard } from "@/components/ui/HeadlineCard";
import { useHeadlinesState } from "@/lib/repositories/headlines";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";
import type { NewsHeadline } from "@shared/contracts";

const cats: Array<"All" | NewsHeadline["category"]> = ["All", "Transfers", "Injuries", "Results", "News"];

export default function News() {
  usePageMeta(staticPageMeta["/news"]);
  const { data, status } = useHeadlinesState();
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const list = useMemo(() => (cat === "All" ? data : data.filter((h) => h.category === cat)), [cat, data]);
  const [lead, ...rest] = list;

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="BBC Sport · The Guardian · Sky Sports" title="Football News" />
      <p className="max-w-3xl text-ui text-ink-2">
        Real headlines from the publishers&apos; own feeds, refreshed every 30 minutes. Each story opens on the source&apos;s site.
        Categories are sorted automatically by keywords, not by an editor.
      </p>
      <Tabs id="news" tabs={cats.map((c) => ({ value: c, label: c }))} active={cat} onChange={(v) => setCat(v as typeof cat)} className="max-w-full" />

      {status !== "ready" || list.length === 0 ? (
        <DataState
          status={status}
          empty={list.length === 0}
          loadingLabel="Loading headlines…"
          emptyTitle="Nothing in this category right now"
          emptyBody="No recent headlines matched. Try another category — the feeds refresh every 30 minutes."
        />
      ) : (
        <>
          {lead && <HeadlineCard h={lead} lead />}
          <div className="grid gap-3 lg:grid-cols-2">
            {rest.map((h) => (
              <HeadlineCard key={h.id} h={h} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
