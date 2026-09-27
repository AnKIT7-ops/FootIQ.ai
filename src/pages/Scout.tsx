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
import { usePlayersState } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { useVoiceInput } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { bump } from "@/lib/metrics";
import { track } from "@/lib/analytics";
import type { Player } from "@/data/types";
import { DataState } from "@/components/ui/DataState";
import { MIN_MINUTES, TRAITS, hasSample, profile, traitScore, type Trait } from "@/lib/player-stats";
import { playerPathFor } from "@/lib/slug-builders";
import type { ScoutFilters } from "@shared/contracts";
import { api } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";
import { useAuth } from "@/lib/auth/AuthContext";
import { isDemoEngine } from "@/lib/ai-provenance";

interface ParsedQuery {
  maxAge?: number;
  positions: Array<Player["position"]>;
  traits: Trait[];
  chips: string[];
}

function parse(q: string): ParsedQuery {
  const s = q.toLowerCase();
  const out: ParsedQuery = { positions: [], traits: [], chips: [] };

  const age = s.match(/under\s*(\d{2})(?!\s*m)|younger than\s*(\d{2})|u(\d{2})\b/);
  if (age) {
    const v = Number(age[1] ?? age[2] ?? age[3]);
    if (v >= 16 && v <= 40) {
      out.maxAge = v;
      out.chips.push(`age < ${v}`);
    }
  } else if (/\byoung\b/.test(s)) {
    out.maxAge = 24;
    out.chips.push("age < 24");
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

  const traitMap: Array<[RegExp, Trait]> = [
    [/finish|scor|\bgoals\b|shooting|clinical/, "scoring"],
    [/pass|creat|vision|playmak|assist|chance/, "creating"],
    [/defend|tackl|block|intercept|in the air|aerial|header/, "defending"],
    [/press|work rate|engine|recover|win(s|ning)? (the )?ball/, "ball_winning"],
    [/sav(e|es|ing)|shot.?stop/, "shot_stopping"],
  ];
  for (const [re, key] of traitMap) {
    if (re.test(s) && !out.traits.includes(key)) {
      out.traits.push(key);
      out.chips.push(`excels: ${TRAITS[key].label}`);
    }
  }
  return out;
}

const POSITION_LABEL: Record<Player["position"], string> = { GK: "goalkeeper", DF: "defender", MF: "midfielder", FW: "forward" };

/** The AI's validated filters in the same shape the keyword parser produces. */
function fromAiFilters(f: ScoutFilters): ParsedQuery {
  const out: ParsedQuery = { positions: [...f.positions], traits: [...f.traits], chips: [] };
  if (f.maxAge) {
    out.maxAge = f.maxAge;
    out.chips.push(`age < ${f.maxAge}`);
  }
  for (const pos of f.positions) out.chips.push(POSITION_LABEL[pos]);
  for (const t of f.traits) out.chips.push(`excels: ${TRAITS[t].label}`);
  return out;
}

/**
 * Fit = mean percentile on the requested traits (or on the position's whole
 * per-90 profile when none were asked for). Only players with a real sample
 * are ranked; the number is a ranking of measured output, not a grade.
 */
function scorePlayer(all: Player[], p: Player, q: ParsedQuery): number {
  if (!hasSample(p)) return 0;
  if (q.positions.length && !q.positions.includes(p.position)) return 0;
  if (q.maxAge && (p.age == null || p.age >= q.maxAge)) return 0;
  const traits = q.traits.filter((t) => t !== "shot_stopping" || p.position === "GK");
  if (q.traits.length && traits.length === 0) return 0;
  const pcts = traits.length ? traits.map((t) => traitScore(all, p, t)) : profile(all, p).map((a) => a.pct);
  return Math.max(1, Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length));
}

const examples = ["Young midfielder who creates chances", "Clinical striker under 25", "Defender who wins the ball back", "Goalkeeper who makes saves"];

export default function Scout() {
  usePageMeta({
    title: "AI Scout",
    description: "Describe the player you need in plain language — position, age and what they do well — and get Premier League players ranked on their real per-90 output.",
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

  // Signed in: the AI reads the request (it only produces filters — ranking stays
  // a deterministic scan of the catalog, so it can't invent a player). Otherwise,
  // or if the AI fails or is the mock, the keyword parser is used.
  const { user } = useAuth();
  const [ai, setAi] = useState<{ query: string; parsed: ParsedQuery } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  useEffect(() => {
    const q = submitted.trim();
    if (!q || q.length < 3 || !backendConfigured || !user) return;
    let live = true;
    setAiBusy(true);
    api
      .post<{ filters: ScoutFilters; provider: string }>("/api/ai/scout/parse", { query: q })
      .then((r) => {
        if (live && !isDemoEngine(r.provider)) setAi({ query: submitted, parsed: fromAiFilters(r.filters) });
      })
      .catch(() => {}) // keyword parser stays in charge
      .finally(() => live && setAiBusy(false));
    return () => {
      live = false;
      setAiBusy(false);
    };
  }, [submitted, user]);
  const aiParsed = ai?.query === submitted ? ai.parsed : null;
  const parsed = useMemo(() => aiParsed ?? parse(submitted), [aiParsed, submitted]);
  const { data: players, status: playerStatus } = usePlayersState();
  const results = useMemo(() => {
    if (!submitted.trim()) return [];
    return players
      .map((p) => ({ p, fit: scorePlayer(players, p, parsed) }))
      .filter((r) => r.fit > 0)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 8);
  }, [submitted, parsed, players]);

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Describe them. We'll find them." title="AI Scout" />

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
              placeholder='e.g. "young midfielder who creates chances"'
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
              {aiParsed ? "AI understood" : aiBusy ? "Reading with AI…" : "Keyword match"}
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
              <Card hover onClick={() => navigate(playerPathFor(p))} className="flex flex-wrap items-center gap-4 p-4 md:p-5">
                <span className="hidden w-6 text-center font-mono text-ui text-ink-3 md:block">{i + 1}</span>
                <Avatar name={p.name} photoUrl={p.photoUrl} size={48} ringColor={getTeam(p.teamId).colors[0]} />
                <div className="min-w-0 flex-1">
                  <p className="text-prose font-bold text-ink">{p.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-ink-3">
                    <Crest teamId={p.teamId} size={16} /> {getTeam(p.teamId).short} · {p.role}
                    {p.age != null ? ` · ${p.age}y` : ""}
                  </p>
                  <p className="tabular mt-1.5 font-mono text-caption text-ink-2">
                    {p.stats.minutes} min · {p.stats.goals}G {p.stats.assists}A · {p.stats.xG.toFixed(1)} xG · {p.stats.xA.toFixed(1)} xA
                  </p>
                </div>
                <div className="w-full sm:w-44">
                  <div className="mb-1 flex items-center justify-between">
                    <IQTag>fit score</IQTag>
                    {/* A fit score is model output: amber at any value — a strong fit is louder amber, never emerald. */}
                    <span className={cn("tabular font-display text-xl font-black", fit >= 75 ? "text-iq-ink" : "text-ink")}>{fit}</span>
                  </div>
                  <Meter label="" value={fit} color="var(--iq)" className="[&_span]:hidden" />
                </div>
              </Card>
            </motion.div>
          ))}
          {results.length === 0 &&
            (players.length === 0 ? (
              <DataState status={playerStatus} empty loadingLabel="Loading players…" emptyTitle="Players haven't synced yet" emptyBody="Player data comes from the Premier League's FPL feed and syncs hourly." />
            ) : (
              <Card className="p-8 text-center text-sm text-ink-2">
                No Premier League player with enough minutes fits those constraints. Loosen the age or position filter and scout again.
              </Card>
            ))}
        </div>
      )}

      {!submitted && (
        <IQInsight title="How AI Scout reads you">
          Plain language in, structured filters out: position, age and what you want the player to do well — scoring, chance creation,
          defending, winning the ball back or making saves. Every Premier League player with {MIN_MINUTES}+ minutes is then ranked on their real
          per-90 percentiles for exactly those things. Budget, preferred foot and pace aren't published anywhere free, so they're not guessed.
        </IQInsight>
      )}
    </div>
  );
}
