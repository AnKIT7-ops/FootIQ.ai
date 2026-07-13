import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { IQInsight, IQTag } from "@/components/ui/IQInsight";
import { Radar } from "@/components/charts/Radar";
import { CompareBars } from "@/components/charts/CompareBars";
import { players, getPlayer, attributeLabels } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { cn, money } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import type { Player } from "@/data/types";

const axes = Object.keys(attributeLabels) as Array<keyof Player["attributes"]>;

function similarity(a: Player, b: Player): number {
  let d = 0;
  for (const k of axes) d += Math.abs(a.attributes[k] - b.attributes[k]) ** 1.6;
  let score = 100 - Math.pow(d / axes.length, 1 / 1.6) * 1.55;
  if (a.position !== b.position) score -= 14;
  if (a.role === b.role) score += 5;
  if (a.foot === b.foot) score += 2;
  return Math.max(28, Math.min(97, Math.round(score)));
}

function tacticalFit(a: Player, b: Player): number {
  const ta = getTeam(a.teamId);
  const tb = getTeam(b.teamId);
  const press = 100 - Math.abs(ta.style.pressIntensity - tb.style.pressIntensity);
  const tempo = 100 - Math.abs(ta.style.tempo - tb.style.tempo);
  return Math.round(press * 0.5 + tempo * 0.3 + (a.role === b.role ? 20 : 8));
}

export default function SimilarPlayers() {
  const { id } = useParams();
  const [baseId, setBaseId] = useState(id && players.some((p) => p.id === id) ? id : "saka");
  const base = getPlayer(baseId);

  const [pos, setPos] = useState<string>("all");
  const [league, setLeague] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState(200);
  const [maxAge, setMaxAge] = useState(35);

  const leagues = useMemo(() => Array.from(new Set(players.map((p) => getTeam(p.teamId).league))), []);

  const results = useMemo(
    () =>
      players
        .filter((p) => p.id !== base.id)
        .filter((p) => (pos === "all" ? true : p.position === pos))
        .filter((p) => (league === "all" ? true : getTeam(p.teamId).league === league))
        .filter((p) => p.marketValue <= maxPrice * 1_000_000)
        .filter((p) => p.age <= maxAge)
        .map((p) => ({ p, sim: similarity(base, p), fit: tacticalFit(base, p) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 8),
    [base, pos, league, maxPrice, maxAge],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = results.find((r) => r.p.id === selectedId) ?? results[0];

  usePageMeta({
    title: `Players Similar to ${base.name}`,
    description: `AI similarity engine: statistical doubles for ${base.name} ranked by attribute overlap, with tactical fit and value-gap analysis.`,
    path: id ? `/similar/${base.id}` : "/similar",
  });

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Similarity engine" title="Similar Players" />

      {/* base picker + filters — one control row (dataviz interaction spec) */}
      <Card className="flex flex-wrap items-end gap-x-5 gap-y-4 p-4">
        <label className="block">
          <span className="eyebrow mb-1.5 block">Base player</span>
          <select
            value={baseId}
            onChange={(e) => {
              setBaseId(e.target.value);
              setSelectedId(null);
            }}
            className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-[13.5px] font-medium text-ink outline-none focus:border-accent"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.role}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">Position</span>
          <select value={pos} onChange={(e) => setPos(e.target.value)} className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-[13.5px] text-ink outline-none focus:border-accent">
            <option value="all">Any</option>
            <option value="FW">Forwards</option>
            <option value="MF">Midfielders</option>
            <option value="DF">Defenders</option>
            <option value="GK">Goalkeepers</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">League</span>
          <select value={league} onChange={(e) => setLeague(e.target.value)} className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-[13.5px] text-ink outline-none focus:border-accent">
            <option value="all">All leagues</option>
            {leagues.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-40">
          <span className="eyebrow mb-1.5 block">
            Max price · <span className="text-ink">€{maxPrice}M</span>
          </span>
          <input type="range" min={10} max={200} step={5} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-(--accent)" />
        </label>
        <label className="block min-w-36">
          <span className="eyebrow mb-1.5 block">
            Max age · <span className="text-ink">{maxAge}</span>
          </span>
          <input type="range" min={18} max={35} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} className="w-full accent-(--accent)" />
        </label>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.5fr]">
        {/* ranked list */}
        <div className="space-y-2.5">
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
              <Avatar name={p.name} playerId={p.id} size={40} ringColor={getTeam(p.teamId).colors[0]} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-ink">{p.name}</p>
                <p className="truncate text-[11.5px] text-ink-3">
                  {p.role} · {getTeam(p.teamId).short} · {p.age}y · {money(p.marketValue)}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("tabular font-display text-xl font-black", sim >= 80 ? "text-accent-ink" : "text-ink")}>{sim}</p>
                <IQTag>match</IQTag>
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="py-8 text-center text-sm text-ink-3">No players survive those filters — loosen one.</p>}
        </div>

        {/* detail compare */}
        {selected && (
          <div className="space-y-4">
            <Card className="p-4 md:p-5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <SectionHeader eyebrow="Attribute overlay" title={`${base.name.split(" ").slice(-1)[0]} vs ${selected.p.name.split(" ").slice(-1)[0]}`} className="mb-0" />
                <Badge variant="iq">{selected.sim} similarity</Badge>
              </div>
              <Radar
                axes={axes.map((a) => attributeLabels[a])}
                series={[
                  { label: base.name, color: "var(--chart-1)", values: axes.map((a) => base.attributes[a]) },
                  { label: selected.p.name, color: "var(--chart-4)", values: axes.map((a) => selected.p.attributes[a]) },
                ]}
                size={300}
              />
            </Card>

            <Card className="p-4 md:p-5">
              <SectionHeader eyebrow="Season output" title="Statistical Breakdown" className="mb-4" />
              <CompareBars
                rows={[
                  { label: "Goals", a: base.stats.goals, b: selected.p.stats.goals },
                  { label: "Assists", a: base.stats.assists, b: selected.p.stats.assists },
                  { label: "xG + xA", a: base.stats.xG + base.stats.xA, b: selected.p.stats.xG + selected.p.stats.xA, format: (v) => v.toFixed(1) },
                  { label: "Dribbles / game", a: base.stats.dribblesPerGame, b: selected.p.stats.dribblesPerGame, format: (v) => v.toFixed(1) },
                  { label: "Rating", a: base.stats.rating, b: selected.p.stats.rating, format: (v) => v.toFixed(2), max: 9 },
                ]}
              />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
                <div>
                  <p className="eyebrow">Value gap</p>
                  <p className="tabular mt-1 font-display text-lg font-bold text-ink">
                    {money(Math.abs(base.marketValue - selected.p.marketValue))}
                  </p>
                  <p className="font-mono text-[10px] text-ink-3">{base.marketValue > selected.p.marketValue ? "cheaper" : "pricier"}</p>
                </div>
                <div>
                  <p className="eyebrow">Age gap</p>
                  <p className="tabular mt-1 font-display text-lg font-bold text-ink">{Math.abs(base.age - selected.p.age)}y</p>
                  <p className="font-mono text-[10px] text-ink-3">{selected.p.age < base.age ? "younger" : selected.p.age === base.age ? "same age" : "older"}</p>
                </div>
                <div>
                  <p className="eyebrow">Tactical fit</p>
                  <p className={cn("tabular mt-1 font-display text-lg font-bold", selected.fit >= 75 ? "text-accent-ink" : "text-ink")}>{selected.fit}%</p>
                  <p className="font-mono text-[10px] text-ink-3">system transfer</p>
                </div>
              </div>
            </Card>

            <IQInsight compact title="Why they match" feedback="Similarity explanation">
              {selected.p.name}'s profile overlaps {base.name}'s strongest axes ({axes
                .map((a) => ({ a, d: Math.abs(base.attributes[a] - selected.p.attributes[a]) }))
                .sort((x, y) => x.d - y.d)
                .slice(0, 2)
                .map((x) => attributeLabels[x.a].toLowerCase())
                .join(", ")}) while {getTeam(selected.p.teamId).league === getTeam(base.teamId).league ? "already playing in the same league — no adaptation tax" : "the league switch adds a one-season adaptation risk the fit score discounts"}
              . <Link to={`/player/${selected.p.id}`} className="text-iq-ink underline underline-offset-2">Open full profile <ArrowRight className="inline size-3" aria-hidden /></Link>
            </IQInsight>
          </div>
        )}
      </div>
    </div>
  );
}
