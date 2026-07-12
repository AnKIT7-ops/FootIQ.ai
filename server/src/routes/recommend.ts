import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { RecommendService } from "../services/recommend";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";

const idParam = z.object({ id: z.string().min(1).max(64).regex(/^[\w.-]+$/) });

/** Recommendations — public reads; every item carries its `reason` (explainability rule). */
export function recommendRoutes(recommend: RecommendService) {
  const r = new Hono<AppEnv>();

  r.get("/articles/:id", validate("param", idParam), (c) =>
    ok(c, recommend.relatedArticles(c.req.valid("param").id)),
  );

  r.get("/comparisons/:id", validate("param", idParam), (c) =>
    ok(c, recommend.suggestedComparisons(c.req.valid("param").id)),
  );

  r.get(
    "/teams",
    validate("query", z.object({ favorites: z.string().max(400).optional() })),
    (c) => {
      const favorites = (c.req.valid("query").favorites ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^[\w.-]{1,64}$/.test(s));
      return ok(c, recommend.recommendedTeams(favorites));
    },
  );

  return r;
}
