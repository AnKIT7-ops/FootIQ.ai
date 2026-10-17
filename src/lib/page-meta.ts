/**
 * Page metadata for every route whose content is known at build time. The single
 * source for the page's usePageMeta call AND its prerendered HTML head/body
 * (vite.config.ts prerenderPlugin), so what crawlers and link unfurlers read can't
 * drift from what the app sets. Relative imports only: plain Node loads this at build.
 */
import type { HistoricalMoment, Team } from "../data/types";
import { managerPathFor, momentPathFor, teamPathFor } from "./slug-builders";
import { articleJsonLd, personJsonLd, sportsTeamJsonLd, type PageMeta } from "./seo";

type StaticMeta = PageMeta & { path: string };

export const staticPageMeta = {
  "/matches": {
    title: "Matches",
    description: "Live, upcoming and finished matches with expected goals, momentum and AI match reads.",
    path: "/matches",
  },
  "/schedule": {
    title: "Schedule",
    description:
      "Football fixtures by date — today, tomorrow and the week ahead across Europe's major competitions, with live scores and results.",
    path: "/schedule",
  },
  "/news": {
    title: "Football News",
    description: "The latest football headlines from BBC Sport, the Guardian and Sky Sports, refreshed every 30 minutes.",
    path: "/news",
  },
  "/transfers": {
    title: "Transfer Center",
    description: "The latest real transfer news from BBC Sport, the Guardian and Sky Sports, refreshed every 30 minutes.",
    path: "/transfers",
  },
  "/predictions": {
    title: "Match Predictions",
    description:
      "Win/draw/loss probabilities, expected goals and likeliest scorelines for upcoming fixtures — computed from this season's league tables, with the inputs shown.",
    path: "/predictions",
  },
  "/scout": {
    title: "AI Scout",
    description:
      "Describe the player you need in plain language — position, age and what they do well — and get Premier League players ranked on their real per-90 output.",
    path: "/scout",
  },
  "/compare": {
    title: "Compare Players, Teams & Managers",
    description:
      "Head-to-head comparison on real Premier League per-90 percentiles and season totals — players, teams or managers side by side.",
    path: "/compare",
  },
  "/tactics": {
    title: "Tactical Board",
    description:
      "Drag-and-drop formation builder with live AI structure analysis — line height, compactness, width and head-to-head matchup reads.",
    path: "/tactics",
  },
  "/history": {
    title: "Historical Explorer",
    description: "A century of football, searchable — iconic matches, milestones, rivalries and moments with probability footnotes.",
    path: "/history",
  },
  "/fantasy": {
    title: "Fantasy Assistant",
    description:
      "Fantasy Premier League from the official FPL data: FPL's projected points, transfer trends, injury flags and a five-gameweek fixture difficulty grid.",
    path: "/fantasy",
  },
  "/about": {
    title: "About",
    description:
      "FootIQ is the AI intelligence layer for football — what it is, how the amber/emerald honesty system works, and where the beta is heading.",
    path: "/about",
  },
  "/contact": {
    title: "Contact",
    description: "Get in touch with the FootIQ team — feedback, bug reports, partnerships, or join the beta waitlist.",
    path: "/contact",
  },
  "/privacy": {
    title: "Privacy Policy",
    description:
      "What FootIQ collects, where it lives (Supabase, Cloudflare, Vercel), what goes to Google Gemini, what stays in your browser, and how to get your data deleted.",
    path: "/privacy",
  },
  "/terms": {
    title: "Terms of Service",
    description: "Terms of use for the FootIQ beta — acceptable use, intellectual property, AI content limits and liability.",
    path: "/terms",
  },
  "/disclaimer": {
    title: "Disclaimer",
    description:
      "FootIQ beta disclaimer: demo platform, algorithmically generated insights, informational predictions only — not betting advice.",
    path: "/disclaimer",
  },
} satisfies Record<string, StaticMeta>;

export function teamPageMeta(team: Team): StaticMeta {
  const path = teamPathFor(team);
  return {
    title: `${team.name} — Squad, Tactics & AI Analysis`,
    description: `${team.name}: squad and minutes, fixtures and results, availability, tactical style DNA and the AI tactical report.`,
    path,
    jsonLd: sportsTeamJsonLd(team, path),
    breadcrumbs: [{ name: team.name, path }],
  };
}

export function managerPageMeta(team: Team): StaticMeta {
  const path = managerPathFor(team);
  return {
    title: `${team.manager} — Tactical Style & System`,
    description: `${team.manager}'s game model at ${team.name}: formation, build-up, pressing scheme and the four dials that define the system.`,
    path,
    jsonLd: personJsonLd({ name: team.manager, role: "Manager" }, { teamName: team.name, path }),
    breadcrumbs: [
      { name: "Teams", path: "/matches" },
      { name: team.manager, path },
    ],
  };
}

export function momentPageMeta(moment: HistoricalMoment): StaticMeta {
  const path = momentPathFor(moment);
  return {
    title: `${moment.title} (${moment.year})`,
    description: `${moment.subtitle} — ${moment.detail.slice(0, 140)}`,
    path,
    type: "article",
    jsonLd: articleJsonLd({
      headline: `${moment.title} (${moment.year})`,
      description: moment.subtitle,
      path,
      publishedAt: `${moment.year}-01-01`,
    }),
    breadcrumbs: [
      { name: "History", path: "/history" },
      { name: moment.title, path },
    ],
  };
}
