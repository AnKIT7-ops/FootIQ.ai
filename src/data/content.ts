/**
 * FootIQ content engine — generates the Intelligence library: SEO article
 * pages derived deterministically from the structured dataset.
 *
 * Every article is unique because every sentence interpolates that entity's
 * own numbers, and phrase variants are picked by a PRNG seeded from the
 * article slug — same build, same words; different entity, different words.
 * Regenerated content shifts weekly (weekStamp) so the library stays fresh
 * without ever duplicating itself.
 *
 * This module is alias-free and side-effect-free so the Vite sitemap plugin
 * and (later) the API server can import it directly. When an AI provider is
 * live, each kind maps to a server AI task (aiTaskHint) that replaces the
 * template body with a model-written one — the page shell doesn't change.
 */
import { players, playersOf } from "./players";
import { teams, getTeam, leagueTable } from "./teams";
import { matches, upcomingMatches } from "./matches";
import { news } from "./news";
import { transferRumors } from "./transfers";
import { predictionByMatch } from "./predictions";
import { captainPicks, differentials, gameweek } from "./fantasy";
import type { Match, Player, Team } from "./types";
import { hashCode, seeded, money } from "../lib/utils";
import {
  managerSlug,
  matchPathFor,
  matchSlugFor,
  playerPathFor,
  playerSlug,
  predictionPathFor,
  slugify,
  teamPathFor,
  teamSlug,
} from "../lib/slug-builders";

export type ContentKind =
  | "match-preview"
  | "team-form"
  | "player-analysis"
  | "transfer-analysis"
  | "manager-style"
  | "best-xi"
  | "rising-players"
  | "fantasy-briefing"
  | "historical-comparison"
  | "weekly-digest";

export const contentKindLabels: Record<ContentKind, string> = {
  "match-preview": "Match Preview",
  "team-form": "Team Form",
  "player-analysis": "Player Analysis",
  "transfer-analysis": "Transfer Analysis",
  "manager-style": "Manager DNA",
  "best-xi": "Best XI",
  "rising-players": "Rising Players",
  "fantasy-briefing": "Fantasy Briefing",
  "historical-comparison": "Head to Head",
  "weekly-digest": "Weekly Digest",
};

export interface ContentSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ContentSource {
  label: string;
  path: string;
}

export interface ContentArticle {
  slug: string;
  kind: ContentKind;
  title: string;
  /** One-sentence standfirst under the title; doubles as the meta description. */
  dek: string;
  publishedAt: string; // ISO date (Monday of the current week)
  readMinutes: number;
  sections: ContentSection[];
  tags: string[];
  /** Internal references — the structured pages this analysis is built from. */
  sources: ContentSource[];
  /** Server AI task that upgrades this article once a provider is configured. */
  aiTaskHint?: string;
}

/** Monday of the current week — the whole library re-stamps weekly. */
export function weekStamp(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

/** Seeded pick — same slug, same phrasing; different slug, different phrasing. */
function pickFrom(rand: () => number) {
  return <T>(options: T[]): T => options[Math.floor(rand() * options.length)];
}

function minutes(sections: ContentSection[]): number {
  const words = sections
    .flatMap((s) => [...s.paragraphs, ...(s.bullets ?? []), s.heading ?? ""])
    .join(" ")
    .split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}

function formAvg(form: number[], take = 5): number {
  const recent = form.slice(-take);
  return recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
}

function formTrend(form: number[]): number {
  if (form.length < 6) return 0;
  return formAvg(form.slice(-3), 3) - formAvg(form.slice(0, 3), 3);
}

const wdl = (f: string) => ({
  w: [...f].filter((c) => c === "W").length,
  d: [...f].filter((c) => c === "D").length,
  l: [...f].filter((c) => c === "L").length,
});

// ---- match previews ---------------------------------------------------------

function matchPreview(m: Match): ContentArticle {
  const home = getTeam(m.homeId);
  const away = getTeam(m.awayId);
  const pred = predictionByMatch.get(m.id);
  const slug = `preview-${matchSlugFor(m, teams)}`;
  const rand = seeded(hashCode(slug));
  const pick = pickFrom(rand);
  const hf = wdl(home.form);
  const af = wdl(away.form);
  const homeStar = playersOf(home.id).sort((a, b) => b.stats.rating - a.stats.rating)[0];
  const awayStar = playersOf(away.id).sort((a, b) => b.stats.rating - a.stats.rating)[0];

  const opener = pick([
    `${home.name} host ${away.name} at ${m.venue} in ${m.competition}, and the tactical contrast could hardly be sharper.`,
    `${m.venue} stages ${home.name} against ${away.name} in ${m.competition} — a meeting of two very different game models.`,
    `${away.name} travel to ${m.venue} to face ${home.name} in ${m.competition}, with both benches holding real tactical decisions.`,
  ]);

  const sections: ContentSection[] = [
    {
      paragraphs: [
        opener,
        `${home.short} arrive ${hf.w} wins, ${hf.d} draws and ${hf.l} defeats from their last ${home.form.length}; ${away.short} counter with ${af.w}-${af.d}-${af.l}. The table separates them by ${Math.abs(home.position - away.position)} place${Math.abs(home.position - away.position) === 1 ? "" : "s"} — ${home.short} ${home.position}ᵗʰ on ${home.points} points, ${away.short} ${away.position}ᵗʰ on ${away.points}.`,
      ],
    },
    {
      heading: "Tactical picture",
      paragraphs: [
        `${home.short} build in a ${home.style.formation} — ${home.style.buildUp.toLowerCase()} with ${home.style.press.toLowerCase()} out of possession. ${away.short}'s ${away.style.formation} answers with ${away.style.buildUp.toLowerCase()}. Tempo tilts ${home.style.tempo > away.style.tempo ? home.short : away.short} (${Math.max(home.style.tempo, away.style.tempo)} vs ${Math.min(home.style.tempo, away.style.tempo)}), while press intensity favours ${home.style.pressIntensity > away.style.pressIntensity ? home.short : away.short}.`,
        `${pick([
          `The duel inside the duel: ${homeStar.name} (${homeStar.stats.goals}G ${homeStar.stats.assists}A, ${homeStar.stats.rating.toFixed(2)} rating) against ${awayStar.name} (${awayStar.stats.goals}G ${awayStar.stats.assists}A). Whoever's plan isolates their talisman higher up the pitch probably controls the scoreline.`,
          `Watch ${homeStar.name} — ${homeStar.stats.rating.toFixed(2)} rated with ${homeStar.stats.goals} goals — against ${awayStar.name}, whose ${awayStar.stats.assists} assists make him the visitors' clearest route to goal.`,
        ])}`,
      ],
    },
  ];

  if (pred) {
    sections.push({
      heading: "What the model sees",
      paragraphs: [
        `FootIQ's model prices this at ${pred.homeWin}% ${home.short}, ${pred.draw}% draw, ${pred.awayWin}% ${away.short}, with an expected scoreline around ${pred.expectedHome.toFixed(1)}–${pred.expectedAway.toFixed(1)}. Over 2.5 goals sits at ${pred.over25}%.`,
        ...pred.reasoning.slice(0, 2),
      ],
    });
  }

  return {
    slug,
    kind: "match-preview",
    title: `${home.name} vs ${away.name}: AI Match Preview`,
    dek: `Tactical keys, the star duel and model probabilities for ${home.short} vs ${away.short} in ${m.competition}.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: [home.name, away.name, m.competition, "preview"],
    sources: [
      { label: `${home.name} team page`, path: teamPathFor(home) },
      { label: `${away.name} team page`, path: teamPathFor(away) },
      { label: "Match center", path: matchPathFor(m, teams) },
      ...(pred ? [{ label: "Full prediction", path: predictionPathFor(m, teams) }] : []),
    ],
    aiTaskHint: "prediction_explanation",
  };
}

// ---- team form --------------------------------------------------------------

function teamForm(t: Team): ContentArticle {
  const slug = `form-${teamSlug(t)}`;
  const rand = seeded(hashCode(slug));
  const pick = pickFrom(rand);
  const f = wdl(t.form);
  const squad = playersOf(t.id);
  const inForm = [...squad].sort((a, b) => formAvg(b.form) - formAvg(a.form))[0];
  const gd = t.gf - t.ga;

  const sections: ContentSection[] = [
    {
      paragraphs: [
        pick([
          `${t.name} sit ${t.position}ᵗʰ with ${t.points} points from ${t.played} games — ${f.w} wins in the last ${t.form.length} tell most of the story.`,
          `${t.points} points, ${t.position}ᵗʰ place, a ${t.form} recent run: ${t.name}'s season has a clear shape once you look past the noise.`,
        ]),
        `The underlying numbers: ${t.gf} scored, ${t.ga} conceded (${gd >= 0 ? "+" : ""}${gd}), squad chemistry indexed at ${t.chemistry}. ${t.manager}'s ${t.style.formation} leans on ${t.style.buildUp.toLowerCase()}, and the ${t.style.press.toLowerCase()} defines them without the ball.`,
      ],
    },
    {
      heading: "Who's carrying the run",
      paragraphs: [
        `${inForm.name} is the form barometer — ${formAvg(inForm.form).toFixed(1)} average across recent matches, ${inForm.stats.goals} goals and ${inForm.stats.assists} assists on the season. ${pick([
          `When his rating dips, so do the results; the correlation is not subtle.`,
          `The team's ceiling moves with his involvement — track his heatmap before predicting theirs.`,
        ])}`,
      ],
      bullets: t.aiReport.slice(0, 3),
    },
  ];

  return {
    slug,
    kind: "team-form",
    title: `${t.name} Form Check: What the Numbers Say`,
    dek: `${t.name}'s ${t.form} run decoded — underlying numbers, the player carrying it, and where it breaks.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: [t.name, t.league, "form"],
    sources: [
      { label: `${t.name} team page`, path: teamPathFor(t) },
      { label: `${inForm.name} profile`, path: playerPathFor(inForm) },
      { label: "League table", path: "/matches" },
    ],
    aiTaskHint: "tactics_feedback",
  };
}

// ---- player analysis ---------------------------------------------------------

function playerAnalysis(p: Player): ContentArticle {
  const t = getTeam(p.teamId);
  const slug = `analysis-${playerSlug(p)}`;
  const rand = seeded(hashCode(slug));
  const pick = pickFrom(rand);
  const s = p.stats;
  const trend = formTrend(p.form);

  const sections: ContentSection[] = [
    {
      paragraphs: [
        pick([
          `${p.name} at ${p.age} is ${t.name}'s ${p.role.toLowerCase()} — ${s.goals} goals, ${s.assists} assists and a ${s.rating.toFixed(2)} average rating this season.`,
          `Strip the highlight reels away and ${p.name}'s season reads: ${s.apps} appearances, ${s.goals}G ${s.assists}A, ${s.rating.toFixed(2)} rating for ${t.name}.`,
        ]),
        `The expected numbers ${s.goals > s.xG ? "flatter his finishing" : "suggest more is coming"}: ${s.xG.toFixed(1)} xG against ${s.goals} scored, ${s.xA.toFixed(1)} xA against ${s.assists} assisted. ${s.keyPasses} key passes per game and ${s.passAccuracy}% passing round out the creative profile.`,
      ],
    },
    {
      heading: "The scouting read",
      paragraphs: [
        `${p.style} ${pick([
          `Strengths cluster around ${p.strengths.slice(0, 2).join(" and ").toLowerCase()}; the development edge is ${p.weaknesses[0]?.toLowerCase() ?? "consistency"}.`,
          `What stands out is ${p.strengths[0]?.toLowerCase() ?? "technical security"} — what needs minutes is ${p.weaknesses[0]?.toLowerCase() ?? "decision speed"}.`,
        ])}`,
        `Form is ${trend > 0.15 ? "climbing" : trend < -0.15 ? "cooling" : "steady"} (${p.form.slice(-5).map((n) => n.toFixed(1)).join(", ")} across the last five), market value holds at ${money(p.marketValue)} with a contract to ${p.contractUntil}.`,
      ],
      bullets: [`Strengths: ${p.strengths.join(", ")}`, `Watch-outs: ${p.weaknesses.join(", ")}`],
    },
  ];

  return {
    slug,
    kind: "player-analysis",
    title: `${p.name} Analysed: Numbers Behind the ${p.role}`,
    dek: `${p.name}'s season for ${t.name} under the model's lens — output, expected numbers, form trajectory and the scouting verdict.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: [p.name, t.name, p.position, "scouting"],
    sources: [
      { label: `${p.name} full profile`, path: playerPathFor(p) },
      { label: `${t.name} team page`, path: teamPathFor(t) },
      { label: `Players similar to ${p.name}`, path: `/similar/${p.id}` },
    ],
    aiTaskHint: "scout_report",
  };
}

// ---- transfer analysis --------------------------------------------------------

function transferAnalysis(rumorIndex: number): ContentArticle {
  const r = transferRumors[rumorIndex];
  const p = players.find((x) => x.id === r.playerId);
  const from = getTeam(r.fromId);
  const to = getTeam(r.toId);
  const name = p?.name ?? "the target";
  const slug = `transfer-${slugify(name)}-to-${teamSlug(to)}`;
  const rand = seeded(hashCode(slug));
  const pick = pickFrom(rand);

  const sections: ContentSection[] = [
    {
      paragraphs: [
        pick([
          `The ${name} to ${to.name} thread is ${r.trend === "rising" ? "heating up" : r.trend === "cooling" ? "losing steam" : "holding steady"} — the model prices completion at ${r.probability}%, stage: ${r.stage.toLowerCase()}.`,
          `${to.name}'s pursuit of ${name} sits at ${r.probability}% on FootIQ's board, ${r.trend} over the past week (${r.stage.toLowerCase()}).`,
        ]),
        `The package under discussion: ${money(r.fee)} fee, ${money(r.wages)} weekly wages. Source reliability grades at ${r.reliability}/5. ${r.aiNote}`,
      ],
    },
    {
      heading: "Fit and fallout",
      paragraphs: [
        p
          ? `Tactically, ${name} (${p.role}, ${p.stats.goals}G ${p.stats.assists}A) maps onto ${to.short}'s ${to.style.formation} as a ${p.position === "FW" ? "primary goal threat" : p.position === "MF" ? "progression upgrade" : "structural reinforcement"}; ${from.short} would lose their ${p.stats.rating >= 7.4 ? "highest-leverage attacker" : "squad-depth cornerstone"}.`
          : `The move would reshape both squads' plans for the window.`,
        `Fan sentiment runs ${r.sentiment.positive}% in favour. ${pick([
          `Watch the timeline: ${r.timeline[r.timeline.length - 1]?.event ?? "talks continue"}.`,
          `Latest checkpoint: ${r.timeline[r.timeline.length - 1]?.event ?? "talks continue"}.`,
        ])}`,
      ],
    },
  ];

  return {
    slug,
    kind: "transfer-analysis",
    title: `${name} → ${to.name}: AI Transfer Analysis`,
    dek: `Probability, package, tactical fit and sentiment on the ${name} to ${to.name} rumour — clearly labelled model inference, not reporting.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: [name, from.name, to.name, "transfers"],
    sources: [
      ...(p ? [{ label: `${name} profile`, path: playerPathFor(p) }] : []),
      { label: `${from.name} team page`, path: teamPathFor(from) },
      { label: `${to.name} team page`, path: teamPathFor(to) },
      { label: "Transfer center", path: "/transfers" },
    ],
    aiTaskHint: "transfer_analysis",
  };
}

// ---- manager style -------------------------------------------------------------

function managerStyle(t: Team): ContentArticle {
  const slug = `manager-${managerSlug(t)}`;
  const rand = seeded(hashCode(slug));
  const pick = pickFrom(rand);
  const s = t.style;

  const sections: ContentSection[] = [
    {
      paragraphs: [
        pick([
          `${t.manager}'s ${t.name} are a ${s.formation} side by shape and a ${t.styleTags[0]?.toLowerCase() ?? "possession"} side by conviction.`,
          `Ask what ${t.manager} believes and the pitch answers: ${s.formation}, ${s.buildUp.toLowerCase()}, ${s.press.toLowerCase()}.`,
        ]),
        `The dials: tempo ${s.tempo}/100, width ${s.width}/100, directness ${s.directness}/100, press intensity ${s.pressIntensity}/100 with a ${s.line.toLowerCase()}. Those four numbers explain most of what you'll watch.`,
      ],
    },
    {
      heading: "How it wins — and how it loses",
      paragraphs: [
        `${s.pressIntensity > 70 ? `The press is the playmaker: turnovers inside the opposition half feed the ${s.formation}'s front line before blocks set.` : s.directness > 60 ? `Progression is vertical — fewer passes, faster arrivals, and wide players asked to finish moves rather than recycle them.` : `Control comes first: long spells of possession drag blocks out of shape until a gap earns the final pass.`}`,
        `${pick([
          `Beat it by ${s.line.toLowerCase().includes("high") ? "playing over the line — one runner, one clipped pass" : "forcing tempo the system doesn't want"}; join it and the identity is ${t.styleTags.slice(0, 2).join(", ").toLowerCase()}.`,
          `Opponents target ${s.line.toLowerCase().includes("high") ? "the space behind the last line" : "the flanks before the block settles"} — the trade the system knowingly makes.`,
        ])}`,
      ],
      bullets: t.styleTags.map((tag) => tag),
    },
  ];

  return {
    slug,
    kind: "manager-style",
    title: `${t.manager}: Tactical DNA at ${t.name}`,
    dek: `${t.manager}'s game model at ${t.name} decoded — shape, dials, the trade-offs, and how opponents try to break it.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: [t.manager, t.name, "tactics"],
    sources: [
      { label: `${t.name} team page`, path: teamPathFor(t) },
      { label: "Tactical board", path: "/tactics" },
    ],
    aiTaskHint: "tactics_feedback",
  };
}

// ---- weekly composites -----------------------------------------------------------

function bestXI(): ContentArticle {
  const slug = `best-xi-${weekStamp()}`;
  const byPos = (pos: Player["position"], n: number) =>
    players
      .filter((p) => p.position === pos)
      .sort((a, b) => formAvg(b.form) - formAvg(a.form))
      .slice(0, n);
  const xi = [...byPos("GK", 1), ...byPos("DF", 4), ...byPos("MF", 3), ...byPos("FW", 3)];

  const sections: ContentSection[] = [
    {
      paragraphs: [
        `The form XI of the week, picked by average match rating across recent fixtures — a 4-3-3 chosen by the numbers, not the narrative.`,
      ],
      bullets: xi.map(
        (p) => `${p.position} — ${p.name} (${getTeam(p.teamId).short}): form ${formAvg(p.form).toFixed(1)}, season ${p.stats.rating.toFixed(2)}, ${p.stats.goals}G ${p.stats.assists}A`,
      ),
    },
    {
      heading: "The headline pick",
      paragraphs: [
        (() => {
          const star = xi.sort((a, b) => formAvg(b.form) - formAvg(a.form))[0];
          return `${star.name} anchors the week — ${formAvg(star.form).toFixed(1)} form average, and the eye test agrees with the spreadsheet for once. ${star.strengths[0] ?? "Consistency"} has defined his last month.`;
        })(),
      ],
    },
  ];

  return {
    slug,
    kind: "best-xi",
    title: `FootIQ Best XI — Week of ${weekStamp()}`,
    dek: `The eleven best-performing players of the week by model rating, laid out in a 4-3-3 with the numbers that picked them.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: ["best xi", "form", "weekly"],
    sources: xi.slice(0, 5).map((p) => ({ label: `${p.name} profile`, path: playerPathFor(p) })),
    aiTaskHint: "scout_report",
  };
}

function risingPlayers(): ContentArticle {
  const slug = `rising-players-${weekStamp()}`;
  const rising = [...players]
    .map((p) => ({ p, delta: formTrend(p.form) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  const sections: ContentSection[] = [
    {
      paragraphs: [
        `Five players whose form curve turned upward hardest this month — measured as the gap between their last three ratings and their first three, not vibes.`,
      ],
      bullets: rising.map(
        ({ p, delta }) =>
          `${p.name} (${getTeam(p.teamId).short}, ${p.role}) — trend +${delta.toFixed(2)}, now ${formAvg(p.form, 3).toFixed(1)}; ${p.age}y, valued ${money(p.marketValue)}`,
      ),
    },
    {
      heading: "Why it matters",
      paragraphs: [
        `Form inflections lead price moves and team selection alike. ${rising[0].p.name}'s curve is the one scouts will quote in a month — the model just got there first.`,
      ],
    },
  ];

  return {
    slug,
    kind: "rising-players",
    title: `Rising Players Index — Week of ${weekStamp()}`,
    dek: `The five steepest upward form curves in the dataset this week, with the numbers driving each rise.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: ["rising", "form", "scouting", "weekly"],
    sources: rising.map(({ p }) => ({ label: `${p.name} profile`, path: playerPathFor(p) })),
    aiTaskHint: "scout_report",
  };
}

function fantasyBriefing(): ContentArticle {
  const slug = `fantasy-briefing-gw${gameweek.number}`;
  const cap = captainPicks[0] && players.find((p) => p.id === captainPicks[0].playerId);
  const diff = differentials[0] && players.find((p) => p.id === differentials[0].playerId);

  const sections: ContentSection[] = [
    {
      paragraphs: [
        `Gameweek ${gameweek.number} briefing: the deadline is ${gameweek.deadline}, and the model's captaincy board is led by ${cap?.name ?? "the usual suspects"} at ${captainPicks[0]?.expectedPoints.toFixed(1) ?? "—"} expected points.`,
      ],
      bullets: captainPicks.slice(0, 3).map((c) => {
        const p = players.find((x) => x.id === c.playerId);
        return `${p?.name ?? c.playerId} — xPts ${c.expectedPoints.toFixed(1)}, owned ${c.ownership}%: ${c.note}`;
      }),
    },
    {
      heading: "The differential",
      paragraphs: [
        diff
          ? `${diff.name} at ${differentials[0].ownership}% ownership is the leverage play — ${differentials[0].note}`
          : `Low-ownership leverage plays are thin this week; bank the template.`,
      ],
    },
  ];

  return {
    slug,
    kind: "fantasy-briefing",
    title: `Fantasy Briefing — Gameweek ${gameweek.number}`,
    dek: `Captaincy board, the differential worth the risk and deadline intel for GW${gameweek.number}, straight from the model.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: ["fantasy", `gameweek ${gameweek.number}`, "weekly"],
    sources: [
      { label: "Fantasy assistant", path: "/fantasy" },
      ...(cap ? [{ label: `${cap.name} profile`, path: playerPathFor(cap) }] : []),
    ],
    aiTaskHint: "fantasy_advice",
  };
}

// ---- historical comparisons -------------------------------------------------------

function historicalComparisons(): ContentArticle[] {
  // pair the two top-rated players per position across different teams
  const pairs: [Player, Player][] = [];
  for (const pos of ["FW", "MF", "DF"] as const) {
    const top = players
      .filter((p) => p.position === pos)
      .sort((a, b) => b.stats.rating - a.stats.rating);
    const a = top[0];
    const b = top.find((p) => p.teamId !== a?.teamId);
    if (a && b) pairs.push([a, b]);
  }

  return pairs.map(([a, b]) => {
    const slug = `compared-${playerSlug(a)}-vs-${playerSlug(b)}`;
    const rand = seeded(hashCode(slug));
    const pick = pickFrom(rand);
    const sections: ContentSection[] = [
      {
        paragraphs: [
          pick([
            `${a.name} against ${b.name} is the comparison the position demands: ${a.stats.rating.toFixed(2)} vs ${b.stats.rating.toFixed(2)} by rating, but the profiles diverge everywhere else.`,
            `Same position, different philosophies — ${a.name} and ${b.name} are both elite, and almost nothing alike.`,
          ]),
          `Output: ${a.name} ${a.stats.goals}G ${a.stats.assists}A (${a.stats.xG.toFixed(1)} xG) against ${b.name}'s ${b.stats.goals}G ${b.stats.assists}A (${b.stats.xG.toFixed(1)} xG). Market: ${money(a.marketValue)} vs ${money(b.marketValue)}. Age tilts ${a.age < b.age ? a.name : b.name} (${Math.min(a.age, b.age)} vs ${Math.max(a.age, b.age)}).`,
        ],
      },
      {
        heading: "The verdict",
        paragraphs: [
          `${a.name} wins on ${a.strengths[0]?.toLowerCase() ?? "output"}; ${b.name} answers with ${b.strengths[0]?.toLowerCase() ?? "consistency"}. ${pick([
            `Need a season now? Take the form curve. Building for three years? Take the younger legs.`,
            `The model refuses a clean winner — which is precisely why the comparison page exists.`,
          ])}`,
        ],
      },
    ];
    return {
      slug,
      kind: "historical-comparison" as const,
      title: `${a.name} vs ${b.name}: The Data Verdict`,
      dek: `Two elite ${a.position === "FW" ? "attackers" : a.position === "MF" ? "midfielders" : "defenders"} side by side — output, expected numbers, value and the model's split decision.`,
      publishedAt: weekStamp(),
      readMinutes: minutes(sections),
      sections,
      tags: [a.name, b.name, "comparison"],
      sources: [
        { label: `${a.name} profile`, path: playerPathFor(a) },
        { label: `${b.name} profile`, path: playerPathFor(b) },
        { label: "Compare tool", path: "/compare" },
      ],
      aiTaskHint: "player_compare",
    };
  });
}

// ---- weekly digest -----------------------------------------------------------------

function weeklyDigest(library: ContentArticle[]): ContentArticle {
  const slug = `digest-${weekStamp()}`;
  const previews = library.filter((a) => a.kind === "match-preview").slice(0, 3);
  const leaders = leagueTable.slice(0, 3);
  const hottest = [...transferRumors].sort((a, b) => b.probability - a.probability)[0];
  const hotPlayer = hottest && players.find((p) => p.id === hottest.playerId);

  const sections: ContentSection[] = [
    {
      heading: "The week in one screen",
      paragraphs: [
        `${leaders[0].name} lead on ${leaders[0].points} points with ${leaders[1].name} (${leaders[1].points}) and ${leaders[2].name} (${leaders[2].points}) in pursuit. ${news[0]?.title ?? ""}`,
      ],
      bullets: previews.map((p) => `${p.title} — ${p.dek}`),
    },
    {
      heading: "Market watch",
      paragraphs: [
        hottest && hotPlayer
          ? `The board's hottest thread: ${hotPlayer.name} to ${getTeam(hottest.toId).name} at ${hottest.probability}% — ${hottest.stage.toLowerCase()}, trend ${hottest.trend}.`
          : `The rumour board is quiet — enjoy it while it lasts.`,
      ],
    },
    {
      heading: "Get this in your inbox",
      paragraphs: [
        `This digest is exactly what the FootIQ newsletter delivers weekly: previews, form inflections and market movement, model-first. Subscribe on any page.`,
      ],
    },
  ];

  return {
    slug,
    kind: "weekly-digest",
    title: `FootIQ Weekly Digest — ${weekStamp()}`,
    dek: `The week's football intelligence in one page: title race state, must-read previews and the market's hottest thread.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: ["digest", "newsletter", "weekly"],
    sources: previews.map((p) => ({ label: p.title, path: `/intelligence/${p.slug}` })),
    aiTaskHint: "news_summary",
  };
}

// ---- library ------------------------------------------------------------------------

let cached: ContentArticle[] | null = null;

/** The full generated Intelligence library — built once per session, deterministic per week. */
export function contentLibrary(): ContentArticle[] {
  if (cached) return cached;
  const base: ContentArticle[] = [
    ...upcomingMatches.map(matchPreview),
    ...matches.filter((m) => m.status === "live").map(matchPreview),
    ...teams.map(teamForm),
    ...teams.map(managerStyle),
    ...players.filter((p) => p.starter || p.stats.rating >= 7.2).map(playerAnalysis),
    ...transferRumors.map((_, i) => transferAnalysis(i)),
    bestXI(),
    risingPlayers(),
    fantasyBriefing(),
    ...historicalComparisons(),
  ];
  cached = [weeklyDigest(base), ...base];
  return cached;
}

export function contentBySlug(slug: string): ContentArticle | undefined {
  return contentLibrary().find((a) => a.slug === slug);
}
