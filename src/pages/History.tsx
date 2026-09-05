import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Landmark, Mic, MicOff, Search, Swords, Trophy, Zap } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IQInsight } from "@/components/ui/IQInsight";
import { historicalMoments, searchHistory } from "@/lib/repositories/history";
import { useVoiceInput } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { momentPath } from "@/lib/slugs";
import { DemoDataNotice } from "@/components/ui/DemoDataNotice";

const kindMeta = {
  match: { icon: Swords, label: "Iconic match", color: "text-chart-2" },
  milestone: { icon: Trophy, label: "Milestone", color: "text-iq-ink" },
  rivalry: { icon: Landmark, label: "Rivalry", color: "text-chart-4" },
  moment: { icon: Zap, label: "Moment", color: "text-accent-ink" },
} as const;

const examples = ["greatest comebacks", "last minute title", "messi records", "world cup collapse", "champions league finals"];

export default function History() {
  usePageMeta({
    title: "Historical Explorer",
    description: "A century of football, searchable — iconic matches, milestones, rivalries and moments with probability footnotes.",
    path: "/history",
  });
  const [query, setQuery] = useState("");
  const { listening, supported, start, stop } = useVoiceInput((t) => setQuery(t));
  const results = useMemo(() => (query.trim() ? searchHistory(query) : historicalMoments), [query]);

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="A century of football, searchable" title="Historical Explorer" />
      <DemoDataNotice domain="historical" detail="These moments are illustrative sample data, not a sourced historical record." />

      <Card className="floodlight p-5 md:p-6">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Ask history anything — "greatest comebacks", "5000-1", "Maradona 1986"…'
              className="h-12 w-full rounded-2xl border border-line bg-surface py-3 pl-11 pr-4 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              aria-label="Search football history"
            />
          </div>
          {supported && (
            <button
              onClick={listening ? stop : start}
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                listening ? "border-bad/40 bg-bad/10 text-bad" : "border-line bg-surface text-ink-3 hover:text-ink",
              )}
              aria-label={listening ? "Stop voice input" : "Search history by voice"}
            >
              {listening ? <MicOff className="size-4.5" aria-hidden /> : <Mic className="size-4.5" aria-hidden />}
            </button>
          )}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      {results.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-2">History has no record of that — try one of the example searches.</Card>
      ) : (
        <div className="relative space-y-4 lg:before:absolute lg:before:bottom-4 lg:before:left-[4.35rem] lg:before:top-4 lg:before:w-px lg:before:bg-line">
          {results.map((m, i) => {
            const meta = kindMeta[m.kind];
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.3 }}
                className="flex gap-4 lg:gap-6"
              >
                <div className="hidden w-24 shrink-0 items-start justify-end pt-5 lg:flex">
                  <span className="display relative z-10 rounded-xl border border-line bg-surface px-2.5 py-1 text-lg font-black text-accent-ink">
                    {m.year}
                  </span>
                </div>
                <Card hover className="min-w-0 flex-1 p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider", meta.color)}>
                      <meta.icon className="size-3.5" aria-hidden />
                      {meta.label}
                    </span>
                    <Badge className="lg:hidden">{m.year}</Badge>
                    <span className="ml-auto rounded-lg bg-surface-3 px-2.5 py-1 font-mono text-micro text-ink-2">
                      {m.stat.label}: <strong className="text-ink">{m.stat.value}</strong>
                    </span>
                  </div>
                  <h3 className="display mt-2 text-xl font-bold text-ink">
                    <Link to={momentPath(m)} className="transition-colors hover:text-accent-ink">
                      {m.title}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-ui font-semibold text-ink-2">{m.subtitle}</p>
                  <p className="mt-2 text-ui leading-relaxed text-ink-2">{m.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.tags.slice(0, 5).map((t) => (
                      <button
                        key={t}
                        onClick={() => setQuery(t)}
                        className="rounded-full border border-line px-2.5 py-0.5 font-mono text-micro uppercase tracking-wide text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <IQInsight title="Why these moments">
        Every entry carries a probability footnote — the model's estimate of how unlikely the moment was as it happened. Istanbul at
        half-time: 0.9%. Leicester in August: 5000-1. The improbable is the point.
      </IQInsight>
    </div>
  );
}
