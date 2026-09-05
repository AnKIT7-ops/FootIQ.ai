import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Heart, Play, Share2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { clips, clipCategories } from "@/lib/repositories/clips";
import { getTeam } from "@/lib/repositories/teams";
import { getPlayer } from "@/lib/repositories/players";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { DemoDataNotice } from "@/components/ui/DemoDataNotice";

const catLabel: Record<string, string> = {
  all: "All",
  goal: "Goals",
  assist: "Assists",
  save: "Saves",
  skill: "Skills",
  tackle: "Tackles",
  moment: "Moments",
};

export default function Highlights() {
  usePageMeta({
    title: "Highlights",
    description: "Short-form football clips — goals, assists, saves, skills and moments, filterable by type.",
    path: "/highlights",
  });
  const [cat, setCat] = useState<string>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const list = useMemo(() => (cat === "all" ? clips : clips.filter((c) => c.type === cat)), [cat]);

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Short-form, vertical, endless" title="Highlights" />
      <DemoDataNotice domain="highlight" detail="These clips are placeholder sample data. No video provider is connected." />
      <Tabs id="clips" tabs={clipCategories.map((c) => ({ value: c, label: catLabel[c] }))} active={cat} onChange={setCat} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((c, i) => {
          const team = getTeam(c.teamId);
          const player = c.playerId ? getPlayer(c.playerId) : null;
          const isPlaying = playing === c.id;
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => setPlaying(isPlaying ? null : c.id)}
              className="group relative aspect-[9/15] overflow-hidden rounded-2xl border border-line text-left"
              style={{ background: `linear-gradient(165deg, ${team.colors[0]}40 0%, var(--surface-2) 55%, ${team.colors[1]}22 100%)` }}
              aria-label={`${isPlaying ? "Pause" : "Play"}: ${c.title}`}
            >
              {/* simulated player scene */}
              <div className="absolute inset-0 flex items-center justify-center opacity-90">
                {player ? (
                  <Avatar name={player.name} playerId={player.id} size={72} className={cn("transition-transform duration-500", isPlaying ? "scale-125" : "group-hover:scale-110")} />
                ) : (
                  <Crest teamId={c.teamId} size={64} />
                )}
              </div>

              {/* play state */}
              <div className="absolute inset-0 flex items-center justify-center">
                {!isPlaying && (
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform group-hover:scale-110">
                    <Play className="size-5 fill-white text-white" aria-hidden />
                  </span>
                )}
              </div>

              {/* progress bar when "playing" */}
              {isPlaying && (
                <motion.div
                  key={`${c.id}-progress`}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: c.seconds, ease: "linear" }}
                  onAnimationComplete={() => setPlaying(null)}
                  className="absolute left-0 top-0 h-0.5 bg-accent"
                  aria-hidden
                />
              )}

              <div className="absolute left-3 top-3 flex items-center gap-2">
                <Crest teamId={c.teamId} size={22} />
                <span className="rounded-full bg-black/45 px-2 py-0.5 font-mono text-micro uppercase tracking-wider text-white backdrop-blur-sm">
                  {c.type}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-10">
                <p className="line-clamp-2 text-caption font-bold leading-snug text-white">{c.title}</p>
                <p className="mt-1 line-clamp-2 text-micro leading-snug text-white/70">{c.caption}</p>
                <div className="mt-2 flex items-center gap-3 font-mono text-micro text-white/80">
                  <span>{c.views}</span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3" aria-hidden /> {c.likes}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Share2 className="size-3" aria-hidden /> {c.seconds}s
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
