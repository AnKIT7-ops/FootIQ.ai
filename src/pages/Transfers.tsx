import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronDown, MessageSquareText, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Reliability } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { IQInsight } from "@/components/ui/IQInsight";
import { DonutGauge } from "@/components/charts/DonutGauge";
import { trendingTransfers } from "@/lib/repositories/transfers";
import { getPlayer } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { cn, money } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";

export default function Transfers() {
  usePageMeta({
    title: "Transfer Center",
    description: "Every transfer rumor priced with a completion probability — deal timelines, financials, fan sentiment and AI replacement suggestions.",
    path: "/transfers",
  });
  const [openId, setOpenId] = useState<string | null>(trendingTransfers[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Every rumor, priced" title="Transfer Center" />

      <div className="space-y-3">
        {trendingTransfers.map((r) => {
          const p = getPlayer(r.playerId);
          const from = getTeam(r.fromId);
          const to = getTeam(r.toId);
          const open = openId === r.id;
          const TrendIcon = r.trend === "rising" ? TrendingUp : r.trend === "cooling" ? TrendingDown : Minus;

          return (
            <Card key={r.id} className="overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : r.id)}
                className="flex w-full flex-wrap items-center gap-3 p-4 text-left md:gap-4 md:p-5"
                aria-expanded={open}
              >
                <Avatar name={p.name} playerId={p.id} size={46} ringColor={to.colors[0]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{p.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-3">
                    <span className="inline-flex items-center gap-1"><Crest teamId={from.id} size={16} /> {from.tla}</span>
                    <ArrowRight className="size-3.5" aria-hidden />
                    <span className="inline-flex items-center gap-1"><Crest teamId={to.id} size={16} /> {to.tla}</span>
                    <span className="ml-1 font-mono font-semibold text-ink-2">{money(r.fee)}</span>
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <Reliability score={r.reliability} />
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">{r.stage}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn("tabular font-display text-2xl font-black leading-none", r.probability >= 40 ? "text-accent-ink" : "text-ink")}>
                      {r.probability}%
                    </p>
                    <p className={cn("mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider", r.trend === "rising" ? "text-accent-ink" : r.trend === "cooling" ? "text-bad" : "text-ink-3")}>
                      <TrendIcon className="size-3" aria-hidden />
                      {r.trend}
                    </p>
                  </div>
                  <ChevronDown className={cn("size-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-5 border-t border-line p-4 md:p-5 lg:grid-cols-[1fr_1.1fr_1fr]">
                      {/* timeline + finances */}
                      <div>
                        <p className="eyebrow mb-3">Deal timeline</p>
                        <ol className="relative space-y-3 before:absolute before:bottom-1 before:left-[0.32rem] before:top-1 before:w-px before:bg-line">
                          {r.timeline.map((t, i) => (
                            <li key={i} className="relative flex gap-3">
                              <span className={cn("z-10 mt-1 size-2.5 shrink-0 rounded-full", i === r.timeline.length - 1 ? "bg-accent" : "border-2 border-line-strong bg-bg")} aria-hidden />
                              <div>
                                <span className="font-mono text-[10.5px] text-accent-ink">{t.date}</span>
                                <p className="text-[12.5px] leading-snug text-ink-2">{t.event}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                        <p className="eyebrow mb-2 mt-5">Financial analysis</p>
                        <dl className="space-y-1.5">
                          {r.finances.map((f) => (
                            <div key={f.label} className="flex justify-between gap-4 text-[12.5px]">
                              <dt className="text-ink-3">{f.label}</dt>
                              <dd className="text-right font-medium text-ink">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>

                      {/* model + sentiment */}
                      <div className="flex flex-col items-center gap-4">
                        <DonutGauge value={r.probability} label="Completion probability" size={130} color={r.probability >= 40 ? "var(--chart-1)" : "var(--chart-3)"} />
                        <div className="w-full">
                          <div className="mb-1.5 flex justify-between font-mono text-[11px] text-ink-3">
                            <span>Fan sentiment</span>
                            <span className="text-ink">{r.sentiment.positive}% in favour</span>
                          </div>
                          <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
                            <div className="rounded-l-full bg-chart-1" style={{ width: `${r.sentiment.positive}%` }} />
                            <div className="rounded-r-full bg-chart-5" style={{ width: `${100 - r.sentiment.positive}%` }} />
                          </div>
                          <div className="mt-3 space-y-2">
                            {r.sentiment.sample.slice(0, 2).map((s, i) => (
                              <p key={i} className="flex gap-2 rounded-xl bg-surface-2 p-2.5 text-[12px] leading-snug text-ink-2">
                                <MessageSquareText className={cn("mt-0.5 size-3.5 shrink-0", s.mood === "for" ? "text-accent-ink" : "text-bad")} aria-hidden />
                                <span>
                                  <span className="font-mono text-[10.5px] text-ink-3">{s.handle}</span> {s.text}
                                </span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* IQ + replacements */}
                      <div className="space-y-3">
                        <IQInsight compact title="Model note">{r.aiNote}</IQInsight>
                        <div>
                          <p className="eyebrow mb-2">If it happens — replacements for {from.short}</p>
                          <div className="space-y-2">
                            {r.replacements.map((rid) => {
                              const rp = getPlayer(rid);
                              return (
                                <Link key={rid} to={`/player/${rid}`} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2.5 transition-colors hover:border-line-strong">
                                  <Avatar name={rp.name} playerId={rp.id} size={30} />
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{rp.name}</span>
                                  <span className="font-mono text-[11px] text-ink-3">{money(rp.marketValue)}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      <IQInsight title="How probabilities are built">
        Completion probability weighs six signals: club need, fee alignment, player intent, source reliability, timing pressure (PSR/contract
        windows) and historical outlet accuracy. Scores update as events land — a probability is a live price, not a prediction of certainty.
      </IQInsight>
    </div>
  );
}
