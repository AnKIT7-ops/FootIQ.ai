import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge, FormPills } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { Tabs } from "@/components/ui/Tabs";
import { IQInsight } from "@/components/ui/IQInsight";
import { Radar } from "@/components/charts/Radar";
import { CompareBars } from "@/components/charts/CompareBars";
import { Legend } from "@/components/charts/common";
import { getPlayer, usePlayersState } from "@/lib/repositories/players";
import { teams, getTeam } from "@/lib/repositories/teams";
import { usePageMeta } from "@/lib/seo";
import { ShareBar } from "@/components/ui/ShareBar";
import { track } from "@/lib/analytics";
import type { Player } from "@/data/types";
import { DemoDataNotice } from "@/components/ui/DemoDataNotice";
import { DataState } from "@/components/ui/DataState";
import { AXES, METRICS, MIN_MINUTES, hasSample, percentile, type MetricKey } from "@/lib/player-stats";

export default function Compare() {
  usePageMeta({
    title: "Compare Players, Teams & Managers",
    description: "Head-to-head comparison on real Premier League per-90 percentiles and season totals — players, teams or managers side by side.",
    path: "/compare",
  });
  const [mode, setMode] = useState("players");

  return (
    <div className="space-y-6">
      <SectionHeader
        level={1}
        eyebrow="Head-to-head"
        title="Compare Anything"
        action={
          <Tabs
            id="compare"
            tabs={[
              { value: "players", label: "Players" },
              { value: "teams", label: "Teams" },
              { value: "managers", label: "Managers" },
            ]}
            active={mode}
            onChange={setMode}
          />
        }
      />
      {/* Teams compare on synced league-table numbers and players on FPL season
          stats, so neither carries a notice. Manager records have no provider. */}
      {mode === "managers" && (
        <DemoDataNotice domain="manager" detail="Manager records and profiles here are illustrative sample data. No manager-data provider is connected." />
      )}
      {mode === "players" && <PlayerCompare />}
      {mode === "teams" && <TeamCompare />}
      {mode === "managers" && <ManagerCompare />}
    </div>
  );
}

function Picker({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; label: string }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="eyebrow mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-ui font-medium text-ink outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlayerCompare() {
  const { data: all, status } = usePlayersState();
  if (all.length < 2) {
    return <DataState status={status} empty loadingLabel="Loading players…" emptyTitle="Players haven't synced yet" emptyBody="Player data comes from the Premier League's FPL feed and syncs hourly." />;
  }
  return <PlayerCompareView all={all} />;
}

/** Outfield axes shared by any two outfield players (each ranked within their own position). */
const OUTFIELD_AXES: MetricKey[] = ["goals", "xG", "assists", "xA", "tackles", "recoveries"];

function PlayerCompareView({ all }: { all: Player[] }) {
  const [params, setParams] = useSearchParams();
  const byPoints = useMemo(() => [...all].sort((x, y) => y.fantasy.totalPoints - x.fantasy.totalPoints), [all]);
  const options = useMemo(
    () => [...all].sort((x, y) => x.name.localeCompare(y.name)).map((p) => ({ id: p.id, label: `${p.name} — ${getTeam(p.teamId).short}` })),
    [all],
  );
  const validId = (id: string | null) => (id && all.some((p) => p.id === id) ? id : null);
  const [aId, setA] = useState(() => validId(params.get("a")) ?? byPoints[0].id);
  const [bId, setB] = useState(() => validId(params.get("b")) ?? byPoints[1].id);
  const a = getPlayer(aId) ?? byPoints[0];
  const b = getPlayer(bId) ?? byPoints[1];
  const mounted = useRef(false);

  // shareable URLs: the pair lives in ?a=&b= (replace — no history spam)
  useEffect(() => {
    setParams({ a: aId, b: bId }, { replace: true });
    if (mounted.current) track("comparison_created", { a: aId, b: bId });
    mounted.current = true;
  }, [aId, bId, setParams]);

  const oneKeeper = (a.position === "GK") !== (b.position === "GK");
  const axes = a.position === b.position ? AXES[a.position] : OUTFIELD_AXES;
  const rows = axes.map((k) => ({ k, label: METRICS[k].label, a: percentile(all, a, k), b: percentile(all, b, k) }));
  const gaps = [...rows].sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 3);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row">
        <Picker label="Player A" value={a.id} onChange={setA} options={options} />
        <Picker label="Player B" value={b.id} onChange={setB} options={options} />
      </Card>

      <ShareBar
        title={`${a.name} vs ${b.name}`}
        path={`/compare?a=${a.id}&b=${b.id}`}
        kind="Player Comparison"
        stat={`${a.stats.goals}G ${a.stats.assists}A vs ${b.stats.goals}G ${b.stats.assists}A`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <Card className="p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            {[a, b].map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2.5 ${i === 1 ? "flex-row-reverse text-right" : ""}`}>
                <Avatar name={p.name} photoUrl={p.photoUrl} size={44} ringColor={i === 0 ? "var(--chart-1)" : "var(--chart-4)"} />
                <div>
                  <p className="text-ui font-bold leading-tight text-ink">{p.name}</p>
                  <p className="text-label text-ink-3">
                    {getTeam(p.teamId).tla} · {p.role}
                    {p.age != null ? ` · ${p.age}y` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {oneKeeper || !hasSample(a) || !hasSample(b) ? (
            <p className="py-10 text-center text-caption text-ink-3">
              {oneKeeper
                ? "A goalkeeper and an outfielder share no per-90 axes — compare the season totals instead."
                : `One of these players has under ${MIN_MINUTES} minutes — too small a sample for percentiles.`}
            </p>
          ) : (
            <>
              <p className="eyebrow mb-1">Per-90 percentile vs own position</p>
              <Radar
                axes={rows.map((r) => r.label)}
                series={[
                  { label: a.name, color: "var(--chart-1)", values: rows.map((r) => r.a) },
                  { label: b.name, color: "var(--chart-4)", values: rows.map((r) => r.b) },
                ]}
                size={310}
              />
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="Premier League season to date" title="Side by Side" className="mb-2" />
            <Legend className="mb-4" items={[{ label: a.name, color: "var(--chart-1)" }, { label: b.name, color: "var(--chart-4)" }]} />
            <CompareBars
              rows={[
                { label: "Minutes", a: a.stats.minutes, b: b.stats.minutes },
                { label: "Goals", a: a.stats.goals, b: b.stats.goals },
                { label: "Assists", a: a.stats.assists, b: b.stats.assists },
                { label: "xG", a: a.stats.xG, b: b.stats.xG, format: (v) => v.toFixed(1) },
                { label: "xA", a: a.stats.xA, b: b.stats.xA, format: (v) => v.toFixed(1) },
                { label: "Tackles", a: a.stats.tackles, b: b.stats.tackles },
                { label: "Recoveries", a: a.stats.recoveries, b: b.stats.recoveries },
                { label: "FPL points", a: a.fantasy.totalPoints, b: b.fantasy.totalPoints },
              ]}
            />
          </Card>
          {!oneKeeper && hasSample(a) && hasSample(b) && (
            <Card className="p-4 md:p-5">
              <SectionHeader title="Biggest gaps" className="mb-2" />
              <ul className="space-y-1.5 text-ui text-ink-2">
                {gaps.map((g) => (
                  <li key={g.k}>
                    <strong className="text-ink">{g.label} per 90:</strong> {g.a >= g.b ? a.name : b.name} — {ordinal(Math.max(g.a, g.b))} vs{" "}
                    {ordinal(Math.min(g.a, g.b))} percentile.
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function TeamCompare() {
  const [aId, setA] = useState("ars");
  const [bId, setB] = useState("liv");
  const a = getTeam(aId);
  const b = getTeam(bId);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row">
        <Picker label="Team A" value={aId} onChange={setA} options={teams.map((t) => ({ id: t.id, label: t.name }))} />
        <Picker label="Team B" value={bId} onChange={setB} options={teams.map((t) => ({ id: t.id, label: t.name }))} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            {[a, b].map((t, i) => (
              <div key={t.id} className={`flex items-center gap-3 ${i === 1 ? "flex-row-reverse text-right" : ""}`}>
                <Crest teamId={t.id} size={44} />
                <div>
                  <p className="text-body font-bold text-ink">{t.short}</p>
                  <FormPills form={t.form} />
                </div>
              </div>
            ))}
          </div>
          <Legend className="mb-4" items={[{ label: a.short, color: "var(--chart-1)" }, { label: b.short, color: "var(--chart-4)" }]} />
          <CompareBars
            rows={[
              { label: "Points", a: a.points, b: b.points },
              { label: "Goals for", a: a.gf, b: b.gf },
              { label: "Goals against (fewer better)", a: a.ga, b: b.ga },
              { label: "Squad chemistry", a: a.chemistry, b: b.chemistry, max: 100 },
              { label: "Press intensity", a: a.style.pressIntensity, b: b.style.pressIntensity, max: 100 },
              { label: "Tempo", a: a.style.tempo, b: b.style.tempo, max: 100 },
              { label: "Directness", a: a.style.directness, b: b.style.directness, max: 100 },
            ]}
          />
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[a, b].map((t) => (
              <Card key={t.id} className="p-4">
                <p className="eyebrow mb-2">{t.short} · silverware</p>
                <ul className="space-y-1.5">
                  {t.trophies.map((tr) => (
                    <li key={tr.name} className="flex items-baseline justify-between text-ui">
                      <span className="text-ink-2">{tr.name}</span>
                      <span className="tabular font-mono font-bold text-ink">{tr.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 text-caption leading-relaxed text-ink-3">
                  {t.style.formation} · {t.styleTags.join(" · ")}
                </p>
              </Card>
            ))}
          </div>
          <IQInsight title="Tactical clash">
            {a.short}'s {a.styleTags[0].toLowerCase()} runs directly into {b.short}'s {b.styleTags[0].toLowerCase()}. The pressing
            differential ({a.style.pressIntensity} vs {b.style.pressIntensity}) says {a.style.pressIntensity > b.style.pressIntensity ? a.short : b.short} will
            dictate territory, but {a.style.directness > b.style.directness ? a.short : b.short}'s directness is the counter-lever: expect the
            game to be decided in transition moments rather than settled possession.
          </IQInsight>
        </div>
      </div>
    </div>
  );
}

function ManagerCompare() {
  const [aId, setA] = useState("ars");
  const [bId, setB] = useState("liv");
  const a = getTeam(aId);
  const b = getTeam(bId);
  const ppg = (t: typeof a) => (t.points / Math.max(1, t.played)).toFixed(2);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row">
        <Picker label="Manager A" value={aId} onChange={setA} options={teams.map((t) => ({ id: t.id, label: `${t.manager} — ${t.short}` }))} />
        <Picker label="Manager B" value={bId} onChange={setB} options={teams.map((t) => ({ id: t.id, label: `${t.manager} — ${t.short}` }))} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {[a, b].map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex items-center gap-3.5">
              <Avatar name={t.manager} size={52} ringColor={t.colors[0]} />
              <div>
                <p className="text-prose font-bold text-ink">{t.manager}</p>
                <p className="flex items-center gap-1.5 text-caption text-ink-3">
                  <Crest teamId={t.id} size={16} /> {t.name}
                </p>
              </div>
              <Badge variant="accent" className="ml-auto">{ppg(t)} PPG</Badge>
            </div>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-ui">
              <div className="flex justify-between"><dt className="text-ink-3">System</dt><dd className="font-medium text-ink">{t.style.formation}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Build-up</dt><dd className="max-w-[60%] text-right text-ink-2">{t.style.buildUp}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Press</dt><dd className="max-w-[60%] text-right text-ink-2">{t.style.press}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Identity</dt><dd className="text-right text-ink-2">{t.styleTags.join(", ")}</dd></div>
            </dl>
            <div className="mt-4 space-y-1.5 border-t border-line pt-3.5">
              <p className="flex items-start gap-2 text-caption text-ink-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden />{t.aiReport[0]}</p>
              <p className="flex items-start gap-2 text-caption text-ink-2"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />{t.aiReport[1]}</p>
            </div>
          </Card>
        ))}
      </div>

      <IQInsight title="Touchline verdict" feedback="Manager comparison verdict">
        {a.manager} ({ppg(a)} points per game) versus {b.manager} ({ppg(b)}): {Number(ppg(a)) > Number(ppg(b)) ? a.manager : b.manager} holds the
        results edge this season, but style contrast is the story — {a.style.tempo > b.style.tempo ? `${a.manager} plays the faster game` : `${b.manager} plays the faster game`}{" "}
        while the other trades tempo for control. In a one-off, the higher press ({a.style.pressIntensity > b.style.pressIntensity ? a.manager : b.manager}) usually
        owns the first 30 minutes; game management decides the last 30.
      </IQInsight>
    </div>
  );
}
