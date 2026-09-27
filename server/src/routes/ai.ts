import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv, Services } from "../types";
import type { CatalogService } from "../services/catalog";
import { prompts, promptVariants, type RenderedPrompt } from "../ai/prompts";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";
import { requireUser } from "../middleware/auth";
import { aiCharge } from "../middleware/entitlements";
import { rateLimit, rateLimits } from "../middleware/rate-limit";
import { ApiError } from "../lib/errors";
import { cleanText } from "../lib/sanitize";
import { forecastFixture } from "../../../shared/forecast";

const id = z.string().min(1).max(64).regex(/^[\w.-]+$/);

/**
 * AI generation surface. Every endpoint:
 *   auth -> rate limit (user + IP) -> flag check -> prompt registry -> AiService
 * AiService charges the user's daily quota and the global ceiling only on a
 * cache miss. Endpoints the frontend doesn't call sit behind experimental_ai
 * (default off) so they aren't free extra surface. Free-text user input is length-capped, sanitized, and only ever lands in
 * the prompt's user turn — never the system prompt.
 */
export function aiRoutes(catalog: CatalogService) {
  const r = new Hono<AppEnv>();

  // Everything below is authenticated + metered.
  r.use("*", requireUser());
  r.use("*", rateLimit(rateLimits.ai));

  const gate = async (services: Services, flag: "ai_scout" | "experimental_ai") => {
    if (!(await services.flags.isEnabled(flag))) {
      throw ApiError.unavailable("This AI feature is currently disabled.");
    }
  };
  const generate = (c: Context<AppEnv>, rendered: RenderedPrompt) =>
    c.get("services").ai.run(rendered, { charge: aiCharge(c) });

  r.post(
    "/scout/:id/report",
    validate("param", z.object({ id })),
    async (c) => {
      const services = c.get("services");
      await gate(services, "ai_scout");
      const player = await catalog.player(c.req.valid("param").id);
      const team = await teamOrNull(catalog, player.teamId);
      // A/B: users inside the prompt_experiments rollout cohort get variant B;
      // variant versions are distinct so cached A/B results never mix.
      const inExperiment = await services.flags.isEnabled("prompt_experiments", c.get("user")?.id);
      const rendered = inExperiment ? promptVariants.scout_report(player, team) : prompts.scout_report(player, team);
      const result = await generate(c, rendered);
      return ok(c, { ...result, promptVersion: rendered.version });
    },
  );

  r.post(
    "/news/:id/summary",
    validate("param", z.object({ id })),
    async (c) => {
      await gate(c.get("services"), "experimental_ai"); // not called by the frontend
      const article = catalog.article(c.req.valid("param").id);
      return ok(c, await generate(c, prompts.news_summary(article)));
    },
  );

  r.post(
    "/predictions/:id/explanation",
    validate("param", z.object({ id })),
    async (c) => {
      await gate(c.get("services"), "experimental_ai"); // not called by the frontend
      const prediction = catalog.prediction(c.req.valid("param").id);
      const match = (await catalog.match(prediction.matchId)).data;
      const home = await teamOrNull(catalog, match.homeId);
      const away = await teamOrNull(catalog, match.awayId);
      return ok(c, await generate(c, prompts.prediction_explanation(prediction, home, away)));
    },
  );

const SCOUT_FILTERS = z.object({
    positions: z.array(z.enum(["GK", "DF", "MF", "FW"])).max(4).default([]),
    maxAge: z.number().int().min(16).max(45).nullish(),
    traits: z.array(z.enum(["scoring", "creating", "defending", "ball_winning", "shot_stopping"])).max(5).default([]),
  });

  /**
   * Scout: the model turns plain English into filters; the CLIENT runs the
   * catalog scan. The model never ranks or names players, so it can't invent one.
   */
  r.post(
    "/scout/parse",
    validate("json", z.object({ query: z.string().min(3).max(300) })),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const result = await generate(c, prompts.scout_query(cleanText(c.req.valid("json").query, 300)));
      // Models wrap JSON in fences or prose now and then; take the first object.
      const raw = result.text.match(/\{[\s\S]*\}/)?.[0];
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      const filters = SCOUT_FILTERS.safeParse(parsed);
      if (!filters.success) {
        throw new ApiError("upstream_error", "The AI couldn't turn that into filters. Try rephrasing.");
      }
      const f = filters.data;
      return ok(c, {
        filters: {
          positions: f.positions,
          traits: f.traits,
          ...(f.maxAge != null ? { maxAge: f.maxAge } : {}),
        },
        provider: result.provider,
        model: result.model,
        cached: result.cached,
      });
    },
  );

  /** Preview of a real synced fixture: table facts + the shared Poisson forecast, explained. */
  r.post(
    "/fixtures/:id/preview",
    validate("param", z.object({ id })),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const match = (await catalog.match(c.req.valid("param").id)).data;
      if (match.status !== "upcoming") throw new ApiError("bad_request", "Previews are for fixtures that haven't kicked off.");
      const { data: teams } = await catalog.teams();
      const home = teams.find((t) => t.id === match.homeId);
      const away = teams.find((t) => t.id === match.awayId);
      if (!home || !away) throw ApiError.notFound("Team");
      const f = forecastFixture(match, teams);
      return ok(
        c,
        await generate(
          c,
          prompts.fixture_preview({
            matchId: match.id,
            competition: match.competition,
            kickoffIso: match.kickoffIso,
            venue: match.venue,
            home,
            away,
            forecast: f.ok ? f.forecast : null,
            noForecastReason: f.ok ? undefined : f.reason,
          }),
        ),
      );
    },
  );

  r.post(
    "/fantasy/advice",
    validate("json", z.object({ question: z.string().min(3).max(500) })),
    async (c) => {
      await gate(c.get("services"), "experimental_ai"); // not called by the frontend
      const question = cleanText(c.req.valid("json").question, 500);
      const [{ data: board }, { data: players }] = await Promise.all([catalog.fantasy(), catalog.players()]);
      const picks = players
        .filter((p) => p.availability === "available")
        .sort((a, b) => b.fantasy.expectedPoints - a.fantasy.expectedPoints)
        .slice(0, 12)
        .map((p) => ({ name: p.name, position: p.role, teamId: p.teamId, ...p.fantasy }));
      return ok(c, await generate(c, prompts.fantasy_advice({ gameweek: board.gameweek, picks, question })));
    },
  );

  /**
   * Concierge chat. The model answers from a snapshot of what FootIQ holds and
   * is told to say so when that isn't enough. Each source degrades to "not
   * held" instead of failing the answer: players 503 until the first FPL sync.
   */
  r.post(
    "/ask",
    validate("json", z.object({ question: z.string().min(2).max(500) })),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const held = <T>(p: Promise<T>) => p.catch(() => null);
      const [teams, matches, players] = await Promise.all([held(catalog.teams()), held(catalog.matches()), held(catalog.players())]);
      const teamList = teams?.data ?? [];
      const upcoming = [...(matches?.data.upcoming ?? [])]
        .sort((a, b) => a.kickoffIso.localeCompare(b.kickoffIso))
        .slice(0, 12)
        .map((m) => {
          const f = forecastFixture(m, teamList);
          return { ...m, forecast: f.ok ? f.forecast : null };
        });
      return ok(
        c,
        await generate(
          c,
          prompts.concierge_answer({
            question: cleanText(c.req.valid("json").question, 500),
            teams: teamList,
            upcoming,
            players: players?.data ?? [],
          }),
        ),
      );
    },
  );

  r.post(
    "/tactics/feedback",
    validate(
      "json",
      z.object({
        formation: z.string().min(3).max(20).regex(/^[\d\-x ]+$/i),
        teamId: id.optional(),
        notes: z.string().max(1000).default(""),
      }),
    ),
    async (c) => {
      await gate(c.get("services"), "experimental_ai"); // not called by the frontend
      const body = c.req.valid("json");
      const team = body.teamId ? await teamOrNull(catalog, body.teamId) : null;
      return ok(
        c,
        await generate(
          c,
          prompts.tactical_feedback({
            formation: cleanText(body.formation, 20),
            teamName: team?.name ?? null,
            style: team?.style ?? null,
            notes: cleanText(body.notes, 1000),
          }),
        ),
      );
    },
  );

  r.post(
    "/compare",
    validate("json", z.object({ playerIds: z.array(id).min(2).max(4) })),
    async (c) => {
      await gate(c.get("services"), "experimental_ai"); // not called by the frontend
      const players = await Promise.all(c.req.valid("json").playerIds.map((pid) => catalog.player(pid)));
      return ok(c, await generate(c, prompts.player_comparison(players)));
    },
  );

  return r;
}

async function teamOrNull(catalog: CatalogService, id: string) {
  try {
    return (await catalog.team(id)).data;
  } catch {
    return null;
  }
}
