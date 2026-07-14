import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { IQInsight } from "@/components/ui/IQInsight";
import { Meter } from "@/components/ui/StatTile";
import { predictions } from "@/lib/repositories/predictions";
import { matchById } from "@/lib/repositories/matches";
import { getTeam } from "@/lib/repositories/teams";
import { getPlayer } from "@/lib/repositories/players";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { predictionPath } from "@/lib/slugs";

export default function Predictions() {
  usePageMeta({
    title: "AI Match Predictions",
    description: "Outcome probabilities, expected scorelines, most-likely scores and MVP candidates for every fixture — with the model's reasoning shown.",
    path: "/predictions",
  });
  const [activeId, setActiveId] = useState(predictions[0].matchId);
  const active = predictions.find((p) => p.matchId === activeId) ?? predictions[0];
  const match = matchById.get(active.matchId)!;
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Probabilities, not promises" title="AI Predictions" />

      {/* fixture picker strip */}
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        {predictions.map((p) => {
          const m = matchById.get(p.matchId)!;
          const h = getTeam(m.homeId);
          const a = getTeam(m.awayId);
          const selected = p.matchId === activeId;
          return (
            <button
              key={p.matchId}
              onClick={() => setActiveId(p.matchId)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-2.5 transition-colors",
                selected ? "border-accent/50 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
              )}
              aria-pressed={selected}
            >
              <Crest teamId={h.id} size={22} />
              <span className="font-mono text-label font-semibold text-ink">{h.tla} v {a.tla}</span>
              <Crest teamId={a.id} size={22} />
              <span className="font-mono text-micro text-ink-3">{m.kickoff}</span>
            </button>
          );
        })}
      </div>

      <motion.div key={active.matchId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* outcome probabilities */}
          <Card className="floodlight p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Crest teamId={home.id} size={40} />
                <p className="display text-xl font-bold text-ink md:text-2xl">
                  {home.short} <span className="text-ink-3">vs</span> {away.short}
                </p>
                <Crest teamId={away.id} size={40} />
              </div>
              <Badge variant="iq">Model confidence {active.confidence}%</Badge>
            </div>

            <div className="flex h-11 w-full gap-[3px] overflow-hidden rounded-2xl" role="img" aria-label={`Win probabilities: ${home.short} ${active.homeWin}%, draw ${active.draw}%, ${away.short} ${active.awayWin}%`}>
              <motion.div initial={{ flexBasis: 0 }} animate={{ flexBasis: `${active.homeWin}%` }} transition={{ duration: 0.6 }} className="flex items-center justify-center bg-chart-1 font-mono text-caption font-bold text-[#04110c]">
                {active.homeWin}%
              </motion.div>
              <motion.div initial={{ flexBasis: 0 }} animate={{ flexBasis: `${active.draw}%` }} transition={{ duration: 0.6 }} className="flex items-center justify-center bg-surface-3 font-mono text-caption font-bold text-ink-2">
                {active.draw}%
              </motion.div>
              <motion.div initial={{ flexBasis: 0 }} animate={{ flexBasis: `${active.awayWin}%` }} transition={{ duration: 0.6 }} className="flex items-center justify-center bg-chart-4 font-mono text-caption font-bold text-white">
                {active.awayWin}%
              </motion.div>
            </div>
            <div className="mt-2 flex justify-between font-mono text-label text-ink-3">
              <span>{home.short} win</span>
              <span>Draw</span>
              <span>{away.short} win</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
              <div>
                <p className="eyebrow">Expected score</p>
                <p className="tabular mt-1 font-display text-2xl font-bold text-ink">
                  {active.expectedHome.toFixed(1)}–{active.expectedAway.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="eyebrow">Over 2.5 goals</p>
                <p className="tabular mt-1 font-display text-2xl font-bold text-ink">{active.over25}%</p>
              </div>
              <div>
                <p className="eyebrow">Both teams score</p>
                <p className="tabular mt-1 font-display text-2xl font-bold text-ink">{active.btts}%</p>
              </div>
              <div>
                <p className="eyebrow">Kickoff</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink">{match.kickoff.split(" ").slice(-1)[0]}</p>
                <div className="flex flex-col items-start">
                  <button onClick={() => navigate(`/match/${match.id}`)} className="mt-0.5 font-mono text-micro uppercase tracking-wider text-accent-ink hover:underline">
                    Match page →
                  </button>
                  <button onClick={() => navigate(predictionPath(match))} className="mt-0.5 font-mono text-micro uppercase tracking-wider text-iq-ink hover:underline">
                    Full report →
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* reasoning */}
          <IQInsight title="Why the model thinks this" feedback="Prediction reasoning">
            <ul className="space-y-2.5">
              {active.reasoning.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[0.14em] font-mono text-label font-bold text-iq-ink">{String(i + 1).padStart(2, "0")}</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </IQInsight>
        </div>

        <div className="space-y-6">
          {/* score distribution */}
          <Card className="p-4 md:p-5">
            <SectionHeader title="Scorelines" className="mb-4" />
            <div className="space-y-3">
              {active.topScores.map((s) => (
                <Meter key={s.score} label={s.score} value={s.p} max={20} color="var(--chart-2)" />
              ))}
            </div>
          </Card>

          {/* MVP candidates */}
          <Card className="p-4 md:p-5">
            <SectionHeader title="MVP Candidates" className="mb-3" />
            <div className="space-y-2.5">
              {active.mvp.map((c) => {
                const p = getPlayer(c.playerId);
                return (
                  <button
                    key={c.playerId}
                    onClick={() => navigate(`/player/${c.playerId}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong"
                  >
                    <Avatar name={p.name} playerId={p.id} size={36} ringColor={getTeam(p.teamId).colors[0]} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ui font-semibold text-ink">{p.name}</p>
                      <p className="text-label text-ink-3">{p.role} · {getTeam(p.teamId).tla}</p>
                    </div>
                    <span className="tabular font-display text-lg font-bold text-iq-ink">{c.p}%</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4 text-caption leading-relaxed text-ink-3">
            Predictions are probabilistic model outputs for entertainment and analysis — never guarantees. A 70% favourite still loses three
            times in ten.
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
