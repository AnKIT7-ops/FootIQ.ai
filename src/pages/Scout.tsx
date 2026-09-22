import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Mic, MicOff, Search, SlidersHorizontal, X } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { IQInsight, IQTag } from "@/components/ui/IQInsight";
import { ShareBar } from "@/components/ui/ShareBar";
import { Meter } from "@/components/ui/StatTile";
import { players } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { useVoiceInput } from "@/lib/hooks";
import { cn, money } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { bump } from "@/lib/metrics";
import { track } from "@/lib/analytics";
import type { Player } from "@/data/types";
import { DemoDataNotice } from "@/components/ui/DemoDataNotice";

interface ParsedQuery {
  maxPrice?: number;
  maxAge?: number;
  foot?: "Left" | "Right";
  positions: Array<Player["position"]>;
  traits: Array<{ key: keyof Player["attributes"]; label: string }>;
  chips: string[];
}

function parse(q: string): ParsedQuery {
  const s = q.toLowerCase();
  const out: ParsedQuery = { positions: [], traits: [], chips: [] };

  const price = s.match(/(?:under|below|less than|max)\s*€?\s*(\d+)\s*m/);
  if (price) {
    out.maxPrice = Number(price[1]) * 1_000_000;
    out.chips.push(`≤ €${price[1]}M`);
  }
  const age = s.match(/under\s*(\d{2})(?!\s*m)|younger than\s*(\d{2})|u(\d{2})\b/);
  if (age) {
    const v = Number(age[1] ?? age[2] ?? age[3]);
    if (v >= 16 && v <= 40) {
      out.maxAge = v;
      out.chips.push(`age < ${v}`);
    }
  }
  if (s.includes("left-footed") || s.includes("left footed") || s.includes("left foot")) {
    out.foot = "Left";
    out.chips.push("left-footed");
  } else if (s.includes("right-footed") || s.includes("right footed")) {
    out.foot = "Right";
    out.chips.push("right-footed");
  }

  const posMap: Array<[RegExp, Player["position"], string]> = [
    [/winger|wide|wing\b/, "FW", "wide forward"],
    [/striker|forward|number 9|no9|goalscorer/, "FW", "forward"],
    [/midfielder|pivot|number 8|playmaker|regista|ten\b/, "MF", "midfielder"],
    [/defender|cent(?:re|er)[ -]?backs?|\bcbs?\b|(?:full|left|right)[ -]?backs?/, "DF", "defender"],
    [/keeper|goalkeeper|gk\b/, "GK", "goalkeeper"],
  ];
  for (const [re, pos, label] of posMap) {
    if (re.test(s) && !out.positions.includes(pos)) {
      out.positions.push(pos);
      out.chips.push(label);
    }
  }

  const traitMap: Array<[RegExp, keyof Player["attributes"], string]> = [
    [/press|pressing|work rate|engine/, "pressing", "pressing"],
    [/dribbl|take.?on|carrier|carry/, "dribbling", "dribbling"],
    [/pass|creat|vision|playmak/, "vision", "creation"],
    [/finish|scor|shooting|clinical/, "shooting", "finishing"],
    [/pace|fast|quick|rapid|speed/, "pace", "pace"],
    [/defend|tackl|duel/, "defending", "defending"],
    [/physical|strong|aerial|in the air|header|heading|\btall\b/, "physical", "physicality"],
  ];
  for (const [re, key, label] of traitMap) {
    if (re.test(s) && !out.traits.some((t) => t.key === key)) {
      out.traits.push({ key, label });
      out.chips.push(`excels: ${label}`);
    }
  }
  return out;
}

function scorePlayer(p: Player, q: ParsedQuery): number {
  let score = 50;
  if (q.positions.length && !q.positions.includes(p.position)) return 0;
  if (q.maxPrice && p.marketValue > q.maxPrice) return 0;
  if (q.maxAge && p.age >= q.maxAge) return 0;
  if (q.foot && p.foot !== q.foot && p.foot !== "Both") return 0;
  for (const t of q.traits) score += (p.attributes[t.key] - 70) * 1.1;
  score += (p.stats.rating - 7) * 14;
  return Math.round(Math.max(5, Math.min(99, score)));
}

const examples = [
  "Find a left-footed winger under €120M who excels at pressing",
  "Young midfielder under 24 with elite vision",
  "Clinical striker under €100M",
  "Fast defender who wins duels",
];

export default function Scout() {
  usePageMeta({
    title: "AI Scout",
    description: "Describe the player you need in plain language — position, budget, age, foot and traits — and get ranked matches with fit scores.",
    path: "/scout",
  });
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [submitted, setSubmitted] = useState(params.get("q") ?? "");
  const navigate = useNavigate();
  const { listening, supported, start, stop } = useVoiceInput((t) => {
    setQuery(t);
    setSubmitted(t);
  });

  // stay in sync when the palette navigates to /scout?q=… while Scout is already mounted
  useEffect(() => {
    const q = params.get("q");
    if (q !== null) {
      setQuery(q);
      setSubmitted(q);
    }
  }, [params]);

  useEffect(() => {
    if (submitted.trim()) {
      bump("ai_use", "scout");
      track("ai_scout_generated", { query_length: submitted.trim().length });
    }
  }, [submitted]);

  const parsed = useMemo(() => parse(submitted), [submitted]);
  const results = useMemo(() => {
    if (!submitted.trim()) return [];
    return players
      .map((p) => ({ p, fit: scorePlayer(p, parsed) }))
      .filter((r) => r.fit > 0)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 8);
  }, [submitted, parsed]);

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Describe them. We'll find them." title="AI Scout" />
      <DemoDataNotice domain="player" detail="Player profiles, ratings and per-90 statistics on FootIQ are illustrative sample data. No player-statistics provider is connected — football-data.org's free tier covers fixtures and tables only." />

      <Card className="floodlight p-5 md:p-7">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query);
          }}
          className="flex items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // clearing the box resets the whole page to its default state
                if (e.target.value.trim() === "") setSubmitted("");
              }}
              placeholder='e.g. "left-footed winger under €120M who excels at pressing"'
              className="h-13 w-full rounded-2xl border border-line bg-surface py-3.5 pl-11 pr-10 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              aria-label="Describe the player you need"
            />
            {query !== "" && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSubmitted("");
                }}
                className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {supported && (
            <button
              type="button"
              onClick={listening ? stop : start}
              className={cn(
                "flex size-13 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                listening ? "border-bad/40 bg-bad/10 text-bad" : "border-line bg-surface text-ink-3 hover:text-ink",
              )}
              aria-label={listening ? "Stop voice input" : "Describe by voice"}
            >
              {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
            </button>
          )}
          <button
            type="submit"
            className="h-13 shrink-0 rounded-2xl bg-accent px-6 text-body font-semibold text-[#04110c] transition-transform hover:scale-[1.02] active:scale-95"
          >
            Scout
          </button>
        </form>

        {submitted && parsed.chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ink-3">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Understood as
            </span>
            {parsed.chips.map((c) => (
              <Badge key={c} variant="iq">{c}</Badge>
            ))}
          </div>
        )}

        {!submitted && (
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuery(ex);
                  setSubmitted(ex);
                }}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </Card>

      {submitted && (
        <div className="space-y-3">
          {results.length > 0 && (
            <ShareBar
              title={`AI Scout: ${submitted}`}
              path={`/scout?q=${encodeURIComponent(submitted)}`}
              kind="AI Scout Report"
              stat={`${results.length} ranked ${results.length === 1 ? "match" : "matches"} · top fit ${results[0].fit}`}
            />
          )}
          {results.map(({ p, fit }, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
              <Card hover onClick={() => navigate(`/player/${p.id}`)} className="flex flex-wrap items-center gap-4 p-4 md:p-5">
                <span className="hidden w-6 text-center font-mono text-ui text-ink-3 md:block">{i + 1}</span>
                <Avatar name={p.name} playerId={p.id} size={48} ringColor={getTeam(p.teamId).colors[0]} />
                <div className="min-w-0 flex-1">
                  <p className="text-prose font-bold text-ink">{p.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-ink-3">
                    <Crest teamId={p.teamId} size={16} /> {getTeam(p.teamId).short} · {p.role} · {p.age}y · {p.foot}-footed ·{" "}
                    <span className="font-mono font-semibold text-ink-2">{money(p.marketValue)}</span>
                  </p>
                  <p className="mt-1.5 line-clamp-1 text-caption text-ink-2">{p.style}</p>
                </div>
                <div className="w-full sm:w-44">
                  <div className="mb-1 flex items-center justify-between">
                    <IQTag>fit score</IQTag>
                    <span className={cn("tabular font-display text-xl font-black", fit >= 75 ? "text-accent-ink" : "text-ink")}>{fit}</span>
                  </div>
                  <Meter label="" value={fit} color={fit >= 75 ? "var(--chart-1)" : "var(--chart-3)"} className="[&_span]:hidden" />
                </div>
              </Card>
            </motion.div>
          ))}
          {results.length === 0 && (
            <Card className="p-8 text-center text-sm text-ink-2">
              No player in the demo database survives those constraints. Loosen the price or age filter and scout again.
            </Card>
          )}
        </div>
      )}

      {!submitted && (
        <IQInsight title="How AI Scout reads you">
          Plain language in, structured scouting out. The parser extracts position, budget, age, foot and the traits you emphasise, then
          ranks every player by attribute fit and current form. Try voice — describing a player out loud is usually faster than typing.
        </IQInsight>
      )}
    </div>
  );
}
