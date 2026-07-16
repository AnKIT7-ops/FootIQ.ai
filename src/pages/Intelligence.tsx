import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Sparkles } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { WaitlistForm } from "@/components/ui/Waitlist";
import { contentKindLabels, contentLibrary, type ContentKind } from "@/lib/repositories/content";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";

const FILTERS: Array<{ key: ContentKind | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "match-preview", label: "Previews" },
  { key: "player-analysis", label: "Players" },
  { key: "team-form", label: "Form" },
  { key: "manager-style", label: "Managers" },
  { key: "transfer-analysis", label: "Transfers" },
  { key: "historical-comparison", label: "Head to Head" },
  { key: "best-xi", label: "Weekly" },
];

/** "Weekly" groups the composite drops. */
const WEEKLY: ContentKind[] = ["best-xi", "rising-players", "fantasy-briefing", "weekly-digest"];

export default function Intelligence() {
  const [filter, setFilter] = useState<ContentKind | "all">("all");
  const library = useMemo(() => contentLibrary(), []);
  const shown = useMemo(
    () =>
      filter === "all"
        ? library
        : filter === "best-xi"
          ? library.filter((a) => WEEKLY.includes(a.kind))
          : library.filter((a) => a.kind === filter),
    [library, filter],
  );

  usePageMeta({
    title: "Football Intelligence Library",
    description:
      "AI-generated football analysis, regenerated weekly: match previews, player deep-dives, team form checks, manager tactical DNA, transfer probabilities and the weekly Best XI.",
    path: "/intelligence",
    breadcrumbs: [{ name: "Intelligence", path: "/intelligence" }],
  });

  const digest = library.find((a) => a.kind === "weekly-digest");

  return (
    <div className="space-y-6">
      <SectionHeader
        level={1}
        eyebrow="The IQ Library"
        title="Football Intelligence"
        action={
          <Badge variant="iq">
            <Sparkles className="size-3" aria-hidden /> {library.length} AI reports
          </Badge>
        }
      />

      {digest && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-1">This week</p>
              <Link to={`/intelligence/${digest.slug}`} className="display text-lg font-bold text-ink transition-colors hover:text-accent-ink">
                {digest.title}
              </Link>
              <p className="mt-1 text-ui text-ink-2">{digest.dek}</p>
            </div>
            <div className="w-full max-w-sm">
              <WaitlistForm compact />
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter reports">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 font-mono text-label uppercase tracking-wider transition-colors",
              filter === f.key ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-3 hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => (
          <Link key={a.slug} to={`/intelligence/${a.slug}`} className="group">
            <Card hover className="flex h-full flex-col p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant="iq">{contentKindLabels[a.kind]}</Badge>
                <span className="inline-flex items-center gap-1 font-mono text-micro uppercase tracking-wider text-ink-3">
                  <Clock className="size-3" aria-hidden /> {a.readMinutes} min
                </span>
              </div>
              <h2 className="display text-prose font-bold leading-snug text-ink transition-colors group-hover:text-accent-ink">
                {a.title}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-caption leading-relaxed text-ink-2">{a.dek}</p>
              <p className="mt-auto pt-3 font-mono text-micro uppercase tracking-wider text-ink-3">{a.publishedAt}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
