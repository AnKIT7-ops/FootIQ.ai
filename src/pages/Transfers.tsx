import { SectionHeader } from "@/components/ui/Card";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";
import { DataState } from "@/components/ui/DataState";
import { HeadlineCard } from "@/components/ui/HeadlineCard";
import { useHeadlinesState } from "@/lib/repositories/headlines";

/**
 * Real transfer headlines only. The old rumour tracker (invented fees,
 * probabilities and fan quotes about named players) was removed: no free,
 * verified source publishes rumour data, and a made-up price on a real
 * player's move is exactly the guess-dressed-as-fact the product forbids.
 */
export default function Transfers() {
  usePageMeta(staticPageMeta["/transfers"]);
  const { data: headlineData, status } = useHeadlinesState();
  const transferNews = headlineData.filter((h) => h.category === "Transfers");

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="BBC Sport · The Guardian · Sky Sports" title="Transfer Center" />

      <section aria-label="Latest transfer news" className="space-y-3">
        <SectionHeader title="Latest transfer news" className="mb-0" />
        {status !== "ready" || transferNews.length === 0 ? (
          <DataState
            status={status}
            empty={transferNews.length === 0}
            loadingLabel="Loading transfer news…"
            emptyTitle="No transfer stories right now"
            emptyBody="None of the latest headlines are about transfers. The feeds refresh every 30 minutes."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {transferNews.map((h) => (
              <HeadlineCard key={h.id} h={h} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
