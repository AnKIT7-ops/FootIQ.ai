import type { AiTask } from "../../../../shared/contracts";
import type { Player, Prediction, Team, TransferRumor, NewsArticle } from "../../data/demo";

/**
 * Prompt registry — every prompt the product sends lives here, versioned and
 * separate from provider/transport code. Rules:
 *   * Prompts are functions of TYPED inputs; no string concatenation at call
 *     sites, no user-controlled text interpolated into the SYSTEM prompt
 *     (prompt-injection surface stays in the user turn where it belongs).
 *   * `version` participates in cache keys, so editing a prompt naturally
 *     invalidates stale cached generations.
 *   * Multilingual later = render() gains a locale argument; the registry
 *     shape already isolates that change.
 */

export interface RenderedPrompt {
  task: AiTask;
  version: number;
  system: string;
  prompt: string;
  maxTokens: number;
  /** Stable string identifying the inputs — becomes part of the cache key. */
  cacheSeed: string;
}

const BASE_SYSTEM = `You are FootIQ, a professional football intelligence analyst.
Write in a sharp, factual scouting-desk tone. British football vocabulary.
Ground every claim in the data provided; if the data doesn't support a claim, don't make it.
No preamble, no meta commentary about being an AI. Markdown allowed: short paragraphs and "-" bullets only.`;

export const prompts = {
  scout_report(player: Player, team: Team | null): RenderedPrompt {
    return {
      task: "scout_report",
      version: 2,
      system: BASE_SYSTEM,
      maxTokens: 1200,
      cacheSeed: `${player.id}`,
      prompt: `Write a scout report on the following player.

PLAYER DATA (JSON):
${JSON.stringify({
  name: player.name,
  age: player.age,
  position: player.position,
  role: player.role,
  team: team?.name ?? player.teamId,
  attributes: player.attributes,
  seasonStats: player.stats,
  strengths: player.strengths,
  weaknesses: player.weaknesses,
  style: player.style,
  marketValueEUR: player.marketValue,
  contractUntil: player.contractUntil,
  injuryHistory: player.injuryHistory,
})}

Structure: 1) Profile summary (2-3 sentences). 2) Technical & tactical assessment.
3) Key risks (fitness, age curve, adaptation). 4) Verdict with a suitability rating out of 10
and the profile of club he fits best.`,
    };
  },

  news_summary(article: NewsArticle): RenderedPrompt {
    return {
      task: "news_summary",
      version: 1,
      system: BASE_SYSTEM,
      maxTokens: 400,
      cacheSeed: article.id,
      prompt: `Summarize this article in exactly 3 bullet points (max 20 words each), then one line "Why it matters: ...".

TITLE: ${article.title}
BODY:
${article.body.join("\n")}`,
    };
  },

  transfer_analysis(rumor: TransferRumor, player: Player, from: Team | null, to: Team | null): RenderedPrompt {
    return {
      task: "transfer_analysis",
      version: 1,
      system: BASE_SYSTEM,
      maxTokens: 800,
      cacheSeed: rumor.id,
      prompt: `Analyse this transfer rumour.

RUMOUR (JSON):
${JSON.stringify({
  player: player.name,
  from: from?.name,
  to: to?.name,
  feeEUR: rumor.fee,
  weeklyWagesEUR: rumor.wages,
  probability: rumor.probability,
  stage: rumor.stage,
  timeline: rumor.timeline,
  playerStats: player.stats,
})}

Cover: tactical fit at the destination, fee vs market value, squad-role impact,
and a one-line verdict on whether the move makes sense for each party.`,
    };
  },

  prediction_explanation(prediction: Prediction, home: Team | null, away: Team | null): RenderedPrompt {
    return {
      task: "prediction_explanation",
      version: 1,
      system: BASE_SYSTEM,
      maxTokens: 600,
      cacheSeed: prediction.matchId,
      prompt: `Explain this match prediction for a general audience. Do not invent probabilities beyond those given.

PREDICTION (JSON):
${JSON.stringify({
  home: home?.name,
  away: away?.name,
  homeWin: prediction.homeWin,
  draw: prediction.draw,
  awayWin: prediction.awayWin,
  expectedGoals: [prediction.expectedHome, prediction.expectedAway],
  over25: prediction.over25,
  btts: prediction.btts,
  modelReasoning: prediction.reasoning,
})}

Structure: headline call, three factors driving it, one counter-scenario that would flip it.`,
    };
  },

  fantasy_advice(context: { gameweek: unknown; picks: unknown; question: string }): RenderedPrompt {
    return {
      task: "fantasy_advice",
      version: 1,
      system: BASE_SYSTEM,
      maxTokens: 600,
      // user question participates in the seed — different questions, different cache rows
      cacheSeed: context.question.toLowerCase().slice(0, 120),
      prompt: `You are advising a fantasy football manager.

GAMEWEEK DATA (JSON):
${JSON.stringify({ gameweek: context.gameweek, modelPicks: context.picks })}

MANAGER'S QUESTION: ${context.question}

Give a direct recommendation with reasoning, plus one differential option. Note risk levels.`,
    };
  },

  tactical_feedback(input: { formation: string; teamName: string | null; style: unknown; notes: string }): RenderedPrompt {
    return {
      task: "tactical_feedback",
      version: 1,
      system: BASE_SYSTEM,
      maxTokens: 700,
      cacheSeed: `${input.formation}:${input.notes.toLowerCase().slice(0, 120)}`,
      prompt: `A coach set up this tactical board. Give feedback.

SETUP (JSON):
${JSON.stringify({ formation: input.formation, team: input.teamName, style: input.style })}

COACH'S NOTES: ${input.notes || "(none)"}

Cover: strengths of the shape, exploitable weaknesses, the one change with the highest payoff,
and which opposition setup would punish it.`,
    };
  },

  player_comparison(players: Player[]): RenderedPrompt {
    const ids = players.map((p) => p.id).sort();
    return {
      task: "player_comparison",
      version: 1,
      system: BASE_SYSTEM,
      maxTokens: 900,
      cacheSeed: ids.join("+"),
      prompt: `Compare these players head-to-head.

PLAYERS (JSON):
${JSON.stringify(
  players.map((p) => ({
    name: p.name,
    age: p.age,
    position: p.position,
    role: p.role,
    attributes: p.attributes,
    stats: p.stats,
    style: p.style,
    marketValueEUR: p.marketValue,
  })),
)}

Structure: verdict up front (who and in which context), then per-dimension comparison
(attacking output, creation, defensive work, physical/age profile, value for money).
Finish with "Pick X if ... / Pick Y if ...".`,
    };
  },
} as const;

/**
 * Prompt catalog — admin/observability view of the registry: what exists,
 * which version is live, which tasks have an A/B variant. Maintained next to
 * the prompts so a new prompt without a catalog row fails review, not prod.
 */
export const promptCatalog = [
  { task: "scout_report", version: 2, hasVariant: true, description: "Player scouting report (profile, assessment, risks, verdict)" },
  { task: "news_summary", version: 1, hasVariant: false, description: "3-bullet article summary + why it matters" },
  { task: "transfer_analysis", version: 1, hasVariant: false, description: "Rumour probability, package, fit and fallout" },
  { task: "prediction_explanation", version: 1, hasVariant: false, description: "Reasoning behind match outcome probabilities" },
  { task: "fantasy_advice", version: 1, hasVariant: false, description: "Gameweek captaincy/differential advice" },
  { task: "tactical_feedback", version: 1, hasVariant: false, description: "Formation critique with team context" },
  { task: "player_comparison", version: 1, hasVariant: false, description: "Multi-player data-grounded comparison" },
] as const;

/**
 * A/B variants — an experimental rendering of a task's prompt, selected at
 * runtime by the `prompt_experiments` flag (see AiService.runTask). Variants
 * carry their own version so cached A and B results never collide.
 */
export const promptVariants = {
  scout_report(player: Player, team: Team | null): RenderedPrompt {
    const base = prompts.scout_report(player, team);
    return {
      ...base,
      version: 102, // variant versions live in the 100+ range
      prompt: `${base.prompt}

ADDITIONAL INSTRUCTIONS (variant B): Lead with a single-sentence "headline verdict"
before the profile summary, and end with one contrarian consideration the market
is likely mispricing about this player.`,
    };
  },
} as const;

export type VariantTask = keyof typeof promptVariants;
