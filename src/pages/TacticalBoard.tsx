import { useMemo, useRef, useState } from "react";
import { RotateCcw, Swords } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Crest } from "@/components/ui/Crest";
import { IQInsight } from "@/components/ui/IQInsight";
import { Meter } from "@/components/ui/StatTile";
import { CompareBars } from "@/components/charts/CompareBars";
import { Legend } from "@/components/charts/common";
import { teams, getTeam } from "@/lib/repositories/teams";
import { isDarkHex } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";

type Zone = "GK" | "DF" | "MF" | "FW";
type TeamKey = "A" | "B";

interface Chip {
  id: string;
  team: TeamKey;
  x: number; // absolute % across pitch length (0 = left goal line)
  y: number; // absolute % across pitch width (0 = top)
}

/* ---------- formations (team frame: tx = depth toward opponent, ty = width) ---------- */

const FORMATIONS: Record<string, Array<[number, number]>> = {
  "4-3-3": [
    [6, 50],
    [22, 16], [18, 38], [18, 62], [22, 84],
    [42, 30], [37, 50], [42, 70],
    [68, 16], [74, 50], [68, 84],
  ],
  "4-2-3-1": [
    [6, 50],
    [22, 16], [18, 38], [18, 62], [22, 84],
    [36, 38], [36, 62],
    [58, 18], [60, 50], [58, 82],
    [76, 50],
  ],
  "3-4-2-1": [
    [6, 50],
    [18, 26], [15, 50], [18, 74],
    [42, 10], [38, 38], [38, 62], [42, 90],
    [62, 36], [62, 64],
    [76, 50],
  ],
  "4-4-2": [
    [6, 50],
    [22, 16], [18, 38], [18, 62], [22, 84],
    [48, 14], [42, 38], [42, 62], [48, 86],
    [73, 38], [73, 62],
  ],
};

/* ---------- live role classification: label follows wherever the chip is dragged ---------- */

function roleAt(tx: number, ty: number): { role: string; zone: Zone } {
  const left = ty < 26;
  const right = ty > 74;
  if (tx < 13) return { role: "GK", zone: "GK" };
  if (tx < 32) return left ? { role: "LB", zone: "DF" } : right ? { role: "RB", zone: "DF" } : { role: "CB", zone: "DF" };
  if (left || right) {
    if (tx < 46) return { role: left ? "LWB" : "RWB", zone: "DF" };
    if (tx < 62) return { role: left ? "LM" : "RM", zone: "MF" };
    return { role: left ? "LW" : "RW", zone: "FW" };
  }
  if (tx < 40) return { role: "DM", zone: "MF" };
  if (tx < 57) return { role: "CM", zone: "MF" };
  if (tx < 72) return { role: "AM", zone: "MF" };
  return { role: "ST", zone: "FW" };
}

/** Absolute board coords → team frame (away team B attacks right-to-left). */
function teamFrame(chip: Chip): { tx: number; ty: number } {
  return chip.team === "A" ? { tx: chip.x, ty: chip.y } : { tx: 100 - chip.x, ty: 100 - chip.y };
}

const zoneColor: Record<Zone, string> = {
  GK: "var(--chart-3)",
  DF: "var(--chart-2)",
  MF: "var(--chart-1)",
  FW: "var(--chart-5)",
};

/* ---------- chip builders ---------- */

function singleChips(formation: string): Chip[] {
  return FORMATIONS[formation].map(([tx, ty], i) => ({ id: `a${i}`, team: "A" as const, x: tx, y: ty }));
}

function h2hChips(teamAId: string, teamBId: string): Chip[] {
  const fA = FORMATIONS[getTeam(teamAId).style.formation] ? getTeam(teamAId).style.formation : "4-3-3";
  const fB = FORMATIONS[getTeam(teamBId).style.formation] ? getTeam(teamBId).style.formation : "4-3-3";
  return [
    ...FORMATIONS[fA].map(([tx, ty], i) => ({ id: `a${i}`, team: "A" as const, x: tx, y: ty })),
    ...FORMATIONS[fB].map(([tx, ty], i) => ({ id: `b${i}`, team: "B" as const, x: 100 - tx, y: 100 - ty })),
  ];
}

/* ---------- analysis ---------- */

interface TeamMetrics {
  line: number;
  compact: number;
  width: number;
  centralMids: number;
  highForwards: number;
  deepestDF: number;
  highestOutfield: number;
}

function metricsFor(chips: Chip[]): TeamMetrics {
  const outfield = chips.map((c) => ({ ...teamFrame(c), z: roleAt(teamFrame(c).tx, teamFrame(c).ty).zone })).filter((c) => c.z !== "GK");
  const df = outfield.filter((c) => c.z === "DF");
  const line = df.length ? df.reduce((s, c) => s + c.tx, 0) / df.length : 20;
  const highest = Math.max(...outfield.map((c) => c.tx));
  const deepest = df.length ? Math.min(...df.map((c) => c.tx)) : 15;
  return {
    line,
    compact: highest - deepest,
    width: Math.max(...outfield.map((c) => c.ty)) - Math.min(...outfield.map((c) => c.ty)),
    centralMids: outfield.filter((c) => c.z === "MF" && Math.abs(c.ty - 50) < 26).length,
    highForwards: outfield.filter((c) => c.z === "FW" && c.tx > 62).length,
    deepestDF: deepest,
    highestOutfield: highest,
  };
}

function singleNotes(m: TeamMetrics): string[] {
  const notes: string[] = [];
  if (m.line > 30) notes.push("Very high defensive line — devastating for territory, but leave a sweeper-keeper brief and beware balls in behind.");
  else if (m.line < 16) notes.push("Deep block detected. You'll surrender territory; plan a fast outlet or the clearances just come straight back.");
  else notes.push("Medium line: balanced restart position with room to trap opponents in midfield.");

  if (m.compact > 62) notes.push(`Team is stretched over ${Math.round(m.compact)}% of the pitch — the midfield will be bypassed by one vertical pass. Pull the lines within ~55%.`);
  else if (m.compact < 34) notes.push("Ultra-compact vertical spacing: brilliant for counter-pressing, but you'll need runners to threaten depth.");

  if (m.width < 55) notes.push("Narrow shape: strong central density, but you're inviting a low block to hold its width advantage. Push a full-back higher.");
  if (m.centralMids < 3 && notes.length < 3) notes.push("Light central midfield: elite sides will overload the pivot. Drop a forward between the lines when defending.");
  return notes.slice(0, 3);
}

function h2hNotes(a: TeamMetrics, b: TeamMetrics, nameA: string, nameB: string): string[] {
  const notes: string[] = [];
  const pairs: Array<[TeamMetrics, TeamMetrics, string, string]> = [
    [a, b, nameA, nameB],
    [b, a, nameB, nameA],
  ];
  for (const [m, opp, name, oppName] of pairs) {
    if (m.line > 28 && opp.highForwards >= 2 && notes.length < 2)
      notes.push(`${name}'s line is very high while ${oppName} keep ${opp.highForwards} forwards pinned on it — one ball over the top and it's a footrace. ${name} need recovery pace or a deeper rest-defence.`);
  }
  if (Math.abs(a.centralMids - b.centralMids) >= 1)
    notes.push(
      a.centralMids > b.centralMids
        ? `${nameA} outnumber ${nameB} ${a.centralMids}v${b.centralMids} in central midfield — expect them to control tempo; ${nameB} must press the pivot or concede the middle.`
        : `${nameB} outnumber ${nameA} ${b.centralMids}v${a.centralMids} in central midfield — expect them to control tempo; ${nameA} must press the pivot or concede the middle.`,
    );
  // pressing engagement: how close A's highest players get to B's build-up line (absolute space between fronts)
  const frontGap = 100 - a.highestOutfield - b.highestOutfield;
  if (frontGap < 12 && notes.length < 3)
    notes.push("Both blocks are pushed up — under 12% of the pitch separates the two front lines. This game lives on second balls and duels, not build-up.");
  else if (frontGap > 34 && notes.length < 3)
    notes.push("Huge middle-third no-man's-land between the blocks: whoever's midfield carries the ball through it first gains a free 20 metres every possession.");
  if (a.width - b.width > 22 && notes.length < 3)
    notes.push(`${nameA} stretch the pitch while ${nameB} stay narrow — quick switches will find ${nameA}'s free winger all day.`);
  else if (b.width - a.width > 22 && notes.length < 3)
    notes.push(`${nameB} stretch the pitch while ${nameA} stay narrow — quick switches will find ${nameB}'s free winger all day.`);
  if (notes.length === 0) notes.push("Balanced setups: similar lines, matched midfield numbers. Individual quality and set pieces decide this one.");
  return notes.slice(0, 3);
}

/* ---------- page ---------- */

export default function TacticalBoard() {
  usePageMeta({
    title: "Tactical Board",
    description: "Drag-and-drop formation builder with live AI structure analysis — line height, compactness, width and head-to-head matchup reads.",
    path: "/tactics",
  });
  const [mode, setMode] = useState<"single" | "h2h">("single");
  const [formation, setFormation] = useState("4-3-3");
  const [teamAId, setTeamAId] = useState("mci");
  const [teamBId, setTeamBId] = useState("mun");
  const [chips, setChips] = useState<Chip[]>(() => singleChips("4-3-3"));
  const [ball, setBall] = useState({ x: 50, y: 50 });
  const boardRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);

  const teamA = getTeam(teamAId);
  const teamB = getTeam(teamBId);
  const colorA = teamA.colors[0];
  const colorB = teamB.colors[0].toLowerCase() === teamA.colors[0].toLowerCase() ? teamB.colors[1] : teamB.colors[0];

  const chipsA = useMemo(() => chips.filter((c) => c.team === "A"), [chips]);
  const chipsB = useMemo(() => chips.filter((c) => c.team === "B"), [chips]);
  const mA = useMemo(() => metricsFor(chipsA), [chipsA]);
  const mB = useMemo(() => (mode === "h2h" ? metricsFor(chipsB) : null), [mode, chipsB]);
  const notes = useMemo(
    () => (mode === "h2h" && mB ? h2hNotes(mA, mB, teamA.short, teamB.short) : singleNotes(mA)),
    [mode, mA, mB, teamA.short, teamB.short],
  );

  const reset = () => {
    setBall({ x: 50, y: 50 });
    setChips(mode === "single" ? singleChips(formation) : h2hChips(teamAId, teamBId));
  };

  const setFromPointer = (clientX: number, clientY: number) => {
    const el = boardRef.current;
    if (el === null || dragId.current === null) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(96, Math.max(4, ((clientY - rect.top) / rect.height) * 100));
    const id = dragId.current;
    if (id === "ball") setBall({ x, y });
    else setChips((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        level={1}
        eyebrow="Drag. Drop. Get judged by the model."
        title="Tactical Board"
        action={
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          id="board-mode"
          tabs={[
            { value: "single", label: "Formation Lab" },
            { value: "h2h", label: "Head to Head" },
          ]}
          active={mode}
          onChange={(m) => {
            setMode(m as "single" | "h2h");
            setBall({ x: 50, y: 50 });
            setChips(m === "single" ? singleChips(formation) : h2hChips(teamAId, teamBId));
          }}
        />
        {mode === "single" ? (
          <Tabs
            id="formation"
            tabs={Object.keys(FORMATIONS).map((f) => ({ value: f, label: f }))}
            active={formation}
            onChange={(f) => {
              setFormation(f);
              setChips(singleChips(f));
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <TeamSelect value={teamAId} exclude={teamBId} onChange={(id) => { setTeamAId(id); setChips(h2hChips(id, teamBId)); }} label="Home side" />
            <Swords className="size-4 text-ink-3" aria-hidden />
            <TeamSelect value={teamBId} exclude={teamAId} onChange={(id) => { setTeamBId(id); setChips(h2hChips(teamAId, id)); }} label="Away side" />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card className="p-3 md:p-4">
          {mode === "h2h" && (
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Crest teamId={teamAId} size={22} /> {teamA.short}
                <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">{teamA.style.formation} · attacks →</span>
              </span>
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">← attacks · {teamB.style.formation}</span>
                {teamB.short} <Crest teamId={teamBId} size={22} />
              </span>
            </div>
          )}
          <div
            ref={boardRef}
            className="relative touch-none select-none overflow-hidden rounded-xl"
            onPointerMove={(e) => setFromPointer(e.clientX, e.clientY)}
            onPointerUp={() => (dragId.current = null)}
            onPointerLeave={() => (dragId.current = null)}
          >
            <svg viewBox="0 0 105 68" className="w-full" style={{ background: "var(--pitch)" }} aria-hidden>
              <g stroke="var(--pitch-line)" strokeWidth="0.45" fill="none">
                <rect x="1.2" y="1.2" width="102.6" height="65.6" rx="0.8" />
                <line x1="52.5" y1="1.2" x2="52.5" y2="66.8" />
                <circle cx="52.5" cy="34" r="9.15" />
                <rect x="1.2" y="13.84" width="16.5" height="40.32" />
                <rect x="87.3" y="13.84" width="16.5" height="40.32" />
                <rect x="1.2" y="24.84" width="5.5" height="18.32" />
                <rect x="97.8" y="24.84" width="5.5" height="18.32" />
              </g>
            </svg>

            {/* the ball — draggable, purely for storytelling */}
            <button
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                dragId.current = "ball";
              }}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none text-[17px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] transition-transform hover:scale-125 active:cursor-grabbing md:text-[19px]"
              style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
              aria-label="Drag the ball"
            >
              ⚽
            </button>

            {chips.map((c) => {
              const { tx, ty } = teamFrame(c);
              const { role, zone } = roleAt(tx, ty);
              const fill = mode === "h2h" ? (c.team === "A" ? colorA : colorB) : zoneColor[zone];
              const textColor = mode === "h2h" ? (isDarkHex(fill) ? "#f5f7fa" : "#10151e") : "#04110c";
              return (
                <button
                  key={c.id}
                  onPointerDown={(e) => {
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                    dragId.current = c.id;
                  }}
                  className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  aria-label={`Drag ${c.team === "A" ? teamA.short : teamB.short} ${role}`}
                >
                  <span
                    className="flex size-8 items-center justify-center rounded-full font-mono text-[9.5px] font-bold shadow-lg ring-2 transition-transform hover:scale-110 md:size-9"
                    style={{
                      background: fill,
                      color: textColor,
                      ["--tw-ring-color" as string]: mode === "h2h" ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.25)",
                    }}
                  >
                    {role}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-center font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
            {mode === "single" ? "Attacking → · drag any player — the position label follows the zone" : "Drag anyone on either side · labels re-read the zone as you move"}
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 md:p-5">
            <SectionHeader eyebrow="Live shape metrics" title="Structure" className="mb-4" />
            {mode === "h2h" && mB ? (
              <>
                <Legend className="mb-4" items={[{ label: teamA.short, color: "var(--chart-1)" }, { label: teamB.short, color: "var(--chart-4)" }]} />
                <CompareBars
                  rows={[
                    { label: "Line height", a: mA.line, b: mB.line, max: 50, format: (v) => String(Math.round(v)) },
                    { label: "Vertical stretch", a: mA.compact, b: mB.compact, max: 100, format: (v) => String(Math.round(v)) },
                    { label: "Width utilisation", a: mA.width, b: mB.width, max: 100, format: (v) => String(Math.round(v)) },
                    { label: "Central midfielders", a: mA.centralMids, b: mB.centralMids, max: 6 },
                  ]}
                />
              </>
            ) : (
              <div className="space-y-3.5">
                <Meter label="Defensive line height" value={mA.line} max={50} color="var(--chart-2)" />
                <Meter label="Vertical compactness (lower = tighter)" value={mA.compact} color="var(--chart-1)" />
                <Meter label="Width utilisation" value={mA.width} color="var(--chart-3)" />
              </div>
            )}
          </Card>

          <IQInsight title={mode === "h2h" ? "Matchup read" : "Coach's feedback"} feedback="Tactical board coaching">
            <ul className="space-y-2.5">
              {notes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-iq" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
          </IQInsight>

          <Card className="p-4">
            <p className="eyebrow mb-2.5">Legend</p>
            {mode === "h2h" ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="size-2.5 rounded-full" style={{ background: colorA }} aria-hidden /> {teamA.short}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="size-2.5 rounded-full" style={{ background: colorB }} aria-hidden /> {teamB.short}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">⚽ ball — drag it too</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(Object.keys(zoneColor) as Zone[]).map((z) => (
                  <span key={z} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                    <span className="size-2.5 rounded-full" style={{ background: zoneColor[z] }} aria-hidden />
                    {z === "GK" ? "Keeper" : z === "DF" ? "Defence" : z === "MF" ? "Midfield" : "Attack"}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">⚽ ball — drag it too</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeamSelect({ value, onChange, exclude, label }: { value: string; onChange: (id: string) => void; exclude: string; label: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <Crest teamId={value} size={24} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-line bg-surface-2 px-2.5 text-[13px] font-medium text-ink outline-none focus:border-accent"
        aria-label={label}
      >
        {teams.filter((t) => t.id !== exclude).map((t) => (
          <option key={t.id} value={t.id}>
            {t.short}
          </option>
        ))}
      </select>
    </label>
  );
}
