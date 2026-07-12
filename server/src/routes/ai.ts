import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Services } from "../types";
import type { CatalogService } from "../services/catalog";
import { prompts, promptVariants } from "../ai/prompts";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";
import { requireUser } from "../middleware/auth";
import { consumeQuota } from "../middleware/entitlements";
import { rateLimit, rateLimits } from "../middleware/rate-limit";
import { ApiError } from "../lib/errors";
import { cleanText } from "../lib/sanitize";

const id = z.string().min(1).max(64).regex(/^[\w.-]+$/);

/**
 * AI generation surface. Every endpoint:
 *   flag check -> auth -> rate limit -> quota -> prompt registry -> AiService
 * Free-text user input is length-capped, sanitized, and only ever lands in
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

  r.post(
    "/scout/:id/report",
    validate("param", z.object({ id })),
    consumeQuota("ai_requests"),
    async (c) => {
      const services = c.get("services");
      await gate(services, "ai_scout");
      const player = catalog.player(c.req.valid("param").id);
      const team = await teamOrNull(catalog, player.teamId);
      // A/B: users inside the prompt_experiments rollout cohort get variant B;
      // variant versions are distinct so cached A/B results never mix.
      const inExperiment = await services.flags.isEnabled("prompt_experiments", c.get("user")?.id);
      const rendered = inExperiment ? promptVariants.scout_report(player, team) : prompts.scout_report(player, team);
      const result = await services.ai.run(rendered);
      return ok(c, { ...result, promptVersion: rendered.version });
    },
  );

  r.post(
    "/news/:id/summary",
    validate("param", z.object({ id })),
    consumeQuota("ai_requests"),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const article = catalog.article(c.req.valid("param").id);
      return ok(c, await c.get("services").ai.run(prompts.news_summary(article)));
    },
  );

  r.post(
    "/transfers/:id/analysis",
    validate("param", z.object({ id })),
    consumeQuota("ai_requests"),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const rumor = catalog.transfers().find((t) => t.id === c.req.valid("param").id);
      if (!rumor) throw ApiError.notFound("Transfer rumour");
      const player = catalog.player(rumor.playerId);
      const from = await teamOrNull(catalog, rumor.fromId);
      const to = await teamOrNull(catalog, rumor.toId);
      return ok(c, await c.get("services").ai.run(prompts.transfer_analysis(rumor, player, from, to)));
    },
  );

  r.post(
    "/predictions/:id/explanation",
    validate("param", z.object({ id })),
    consumeQuota("ai_requests"),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const prediction = catalog.prediction(c.req.valid("param").id);
      const match = (await catalog.match(prediction.matchId)).data;
      const home = await teamOrNull(catalog, match.homeId);
      const away = await teamOrNull(catalog, match.awayId);
      return ok(c, await c.get("services").ai.run(prompts.prediction_explanation(prediction, home, away)));
    },
  );

  r.post(
    "/fantasy/advice",
    validate("json", z.object({ question: z.string().min(3).max(500) })),
    consumeQuota("ai_requests"),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const question = cleanText(c.req.valid("json").question, 500);
      const f = catalog.fantasy();
      return ok(
        c,
        await c.get("services").ai.run(
          prompts.fantasy_advice({ gameweek: f.gameweek, picks: f.captainPicks, question }),
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
    consumeQuota("ai_requests"),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const body = c.req.valid("json");
      const team = body.teamId ? await teamOrNull(catalog, body.teamId) : null;
      return ok(
        c,
        await c.get("services").ai.run(
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
    consumeQuota("ai_requests"),
    async (c) => {
      await gate(c.get("services"), "ai_scout");
      const players = c.req.valid("json").playerIds.map((pid) => catalog.player(pid));
      return ok(c, await c.get("services").ai.run(prompts.player_comparison(players)));
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
