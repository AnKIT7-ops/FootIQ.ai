import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { IQInsight, IQTag } from "@/components/ui/IQInsight";
import { Radar } from "@/components/charts/Radar";
import { CompareBars } from "@/components/charts/CompareBars";
import { DataState } from "@/components/ui/DataState";
import { getPlayer, usePlayersState } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { playerPathFor } from "@/lib/slug-builders";
import type { Player } from "@/data/types";
import { AXES, METRICS, MIN_MINUTES, closestAxes, hasSample, percentile, similarity } from "@/lib/player-stats";

export default function SimilarPlayers() {
  const { data: all, status } = usePlayersState();
  if (all.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader level={1} eyebrow="Statistical likeness" title="Similar Players" />
        <DataState status={status} empty loadingLabel="Loading players…" emptyTitle="Players haven't synced yet" emptyBody="Player data comes from the Premier League's FPL feed and syncs hourly." />
      </div>
    );
  }
  return <SimilarView all={all} />;
}

function SimilarView({ all }: { all: Player[] }) {
  const { id } = useParams();
  // Only players with a real sample can be matched on per-90 output.
  const pool = useMemo(() => all.filter(hasSample).sort((a, b) => a.name.localeCompare(b.name)), [all]);
  const fallback = useMemo(() => [...pool].sort((a, b) => b.fantasy.totalPoints - a.fantasy.totalPoints)[0] ?? all[0], [pool, all]);
  const [baseId, setBaseId] = useState(() => (id && getPlayer(id) ? id : fallback.id));
  const base = getPlayer(baseId) ?? fallback;

  const [maxAge, setMaxAge] = useState(40);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(
    () =>
      pool
        .filter((p) => p.id !== base.id && p.position === base.position)
        .filter((p) => p.age == null || p.age <= maxAge)
        .map((p) => ({ p, sim: similarity(all, base, p) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 8),
    [all, pool, base, maxAge],
  );
  const selected = results.find((r) => r.p.id === selectedId) ?? results[0];
  const axes = AXES[base.position];

  usePageMeta({
    title: `Players Similar to ${base.name}`,
    description: `Premier League players whose per-90 output most resembles ${base.name}'s this season, matched on real FPL statistics.`,
    path: id ? `/similar/${base.id}` : "/similar",
  });

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Statistical likeness" title="Similar Players" />

      <Card className="flex flex-wrap items-end gap-x-5 gap-y-4 p-4">
        <label className="block max-w-full">
          <span className="eyebrow mb-1.5 block">Base player</span>
          <select
            value={base.id}
            onChange={(e) => {
              setBaseId(e.target.value);
              setSelectedId(null);
            }}
            className="h-10 max-w-[min(18rem,100%)] rounded-xl border border-line bg-surface-2 px-3 text-ui font-medium text-ink outline-none focus:border-accent"
          >
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {getTeam(p.teamId).short}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-36">
          <span className="eyebrow mb-1.5 block">
            Max age · <span className="text-ink">{maxAge}</span>
          </span>
          <input type="range" min={18} max={40} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} className="w-full accent-(--accent)" />
        </label>
        <p className="basis-full text-caption text-ink-3">
          Same position only, players with {MIN_MINUTES}+ Premier League minutes. Likeness = how close their per-90 percentiles sit.
        </p>
      </Card>

      {!hasSample(base) && (
        <Card className="p-5 text-caption text-ink-2">
          {base.name} has fewer than {MIN_MINUTES} minutes this season — too small a sample to match on. Pick another base player.
        </Card>
      )}

      {hasSample(base) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)]">
          <div className="min-w-0 space-y-2.5">
            {results.map(({ p, sim }) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                  selected?.p.id === p.id ? "border-accent/50 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                )}
                aria-pressed={selected?.p.id === p.id}
              >
                <Avatar name={p.name} photoUrl={p.photoUrl} size={40} ringColor={getTeam(p.teamId).colors[0]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-ink">{p.name}</p>
                  <p className="truncate text-label text-ink-3">
                    {getTeam(p.teamId).short}
                    {p.age != null ? ` · ${p.age}y` : ""} · {p.stats.minutes} min
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("tabular font-display text-xl font-black", sim >= 85 ? "text-iq-ink" : "text-ink")}>{sim}</p>
                  <IQTag>likeness</IQTag>
                </div>
              </button>
            ))}
            {results.length === 0 && <p className="py-8 text-center text-sm text-ink-3">No players survive that age filter — loosen it.</p>}
          </div>

          {selected && (
            <div className="min-w-0 space-y-4">
              <Card className="p-4 md:p-5">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <SectionHeader title={`${base.name.split(" ").slice(-1)[0]} vs ${selected.p.name.split(" ").slice(-1)[0]}`} className="mb-0" />
                  <Badge variant="iq">{selected.sim} likeness</Badge>
                </div>
                <Radar
                  axes={axes.map((k) => METRICS[k].label)}
                  series={[
                    { label: base.name, color: "var(--chart-1)", values: axes.map((k) => percentile(all, base, k)) },
                    { label: selected.p.name, color: "var(--chart-4)", values: axes.map((k) => percentile(all, selected.p, k)) },
                  ]}
                  size={300}
                />
              </Card>

              <Card className="p-4 md:p-5">
                <SectionHeader eyebrow="Premier League season to date" title="Season Totals" className="mb-4" />
                <CompareBars
                  rows={[
                    { label: "Minutes", a: base.stats.minutes, b: selected.p.stats.minutes },
                    { label: "Goals", a: base.stats.goals, b: selected.p.stats.goals },
                    { label: "Assists", a: base.stats.assists, b: selected.p.stats.assists },
                    { label: "xG + xA", a: base.stats.xG + base.stats.xA, b: selected.p.stats.xG + selected.p.stats.xA, format: (v) => v.toFixed(1) },
                    { label: "Recoveries", a: base.stats.recoveries, b: selected.p.stats.recoveries },
                  ]}
                />
              </Card>

              <IQInsight compact title="Why they match" feedback="Similarity explanation">
                {selected.p.name}'s per-90 profile sits closest to {base.name}'s on {closestAxes(all, base, selected.p).join(" and ").toLowerCase()}.
                Likeness compares output only — it says nothing about technique, role or fit.{" "}
                <Link to={playerPathFor(selected.p)} className="text-iq-ink underline underline-offset-2">
                  Open full profile <ArrowRight className="inline size-3" aria-hidden />
                </Link>
              </IQInsight>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
