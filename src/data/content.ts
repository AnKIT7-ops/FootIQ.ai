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
import { teams, getTeam, leagueTable } from "./teams";
import { matches, upcomingMatches } from "./matches";
import { news } from "./news";
import { predictionByMatch } from "./predictions";
import type { Match, Team } from "./types";
import { hashCode, seeded } from "../lib/utils";
import { managerSlug, matchPathFor, matchSlugFor, predictionPathFor, teamPathFor, teamSlug } from "../lib/slug-builders";

/*
 * Player articles (analyses, best XI, rising players, fantasy briefing,
 * head-to-heads) and rumour analyses were removed with the demo player data
 * they were written from. Real players are synced at runtime from FPL; this
 * module runs at build time (sitemap) and can't see them.
 */
export type ContentKind = "match-preview" | "team-form" | "manager-style" | "weekly-digest";

export const contentKindLabels: Record<ContentKind, string> = {
  "match-preview": "Match Preview",
  "team-form": "Team Form",
  "manager-style": "Manager DNA",
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
    dek: `Tactical keys and model probabilities for ${home.short} vs ${away.short} in ${m.competition}.`,
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
      heading: "The model's read",
      paragraphs: [],
      bullets: t.aiReport.slice(0, 3),
    },
  ];

  return {
    slug,
    kind: "team-form",
    title: `${t.name} Form Check: What the Numbers Say`,
    dek: `${t.name}'s ${t.form} run decoded — underlying numbers and where it breaks.`,
    publishedAt: weekStamp(),
    readMinutes: minutes(sections),
    sections,
    tags: [t.name, t.league, "form"],
    sources: [
      { label: `${t.name} team page`, path: teamPathFor(t) },
      { label: "League table", path: "/matches" },
    ],
    aiTaskHint: "tactics_feedback",
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

// ---- weekly digest -----------------------------------------------------------------

function weeklyDigest(library: ContentArticle[]): ContentArticle {
  const slug = `digest-${weekStamp()}`;
  const previews = library.filter((a) => a.kind === "match-preview").slice(0, 3);
  const leaders = leagueTable.slice(0, 3);

  const sections: ContentSection[] = [
    {
      heading: "The week in one screen",
      paragraphs: [
        `${leaders[0].name} lead on ${leaders[0].points} points with ${leaders[1].name} (${leaders[1].points}) and ${leaders[2].name} (${leaders[2].points}) in pursuit. ${news[0]?.title ?? ""}`,
      ],
      bullets: previews.map((p) => `${p.title} — ${p.dek}`),
    },
    {
      heading: "Get this in your inbox",
      paragraphs: [
        `This digest is exactly what the FootIQ newsletter delivers weekly: previews and form inflections, model-first. Subscribe on any page.`,
      ],
    },
  ];

  return {
    slug,
    kind: "weekly-digest",
    title: `FootIQ Weekly Digest — ${weekStamp()}`,
    dek: `The week's football intelligence in one page: title race state and must-read previews.`,
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
  ];
  cached = [weeklyDigest(base), ...base];
  return cached;
}

export function contentBySlug(slug: string): ContentArticle | undefined {
  return contentLibrary().find((a) => a.slug === slug);
}
