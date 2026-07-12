import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { CatalogService } from "../services/catalog";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";

const idParam = z.object({ id: z.string().min(1).max(64).regex(/^[\w.-]+$/) });

/**
 * Read-only football catalog. Public (the product's read surface is free);
 * global + per-scope rate limits applied in app.ts. One service instance per
 * app; `source` metadata tells clients/ops where data came from.
 */
export function catalogRoutes(catalog: CatalogService) {
  const r = new Hono<AppEnv>();
  const meta = { source: catalog.source };

  r.get("/players", (c) => ok(c, catalog.players(), meta));
  r.get("/players/:id", validate("param", idParam), (c) =>
    ok(c, catalog.player(c.req.valid("param").id), meta),
  );
  r.get("/players/:id/similar", validate("param", idParam), (c) =>
    ok(c, catalog.similarPlayers(c.req.valid("param").id), meta),
  );

  r.get("/teams", (c) => ok(c, catalog.teams(), meta));
  r.get("/teams/table", (c) => ok(c, catalog.leagueTable(), meta));
  r.get("/teams/:id", validate("param", idParam), (c) =>
    ok(c, catalog.team(c.req.valid("param").id), meta),
  );
  r.get("/teams/:id/players", validate("param", idParam), (c) =>
    ok(c, catalog.teamPlayers(c.req.valid("param").id), meta),
  );

  r.get("/matches", (c) => ok(c, catalog.matches(), meta));
  r.get("/matches/:id", validate("param", idParam), (c) =>
    ok(c, catalog.match(c.req.valid("param").id), meta),
  );

  r.get("/news", (c) => ok(c, catalog.news(), meta));
  r.get("/news/:id", validate("param", idParam), (c) =>
    ok(c, catalog.article(c.req.valid("param").id), meta),
  );

  r.get("/transfers", (c) => ok(c, catalog.transfers(), meta));
  r.get("/predictions", (c) => ok(c, catalog.predictions(), meta));
  r.get("/predictions/:id", validate("param", idParam), (c) =>
    ok(c, catalog.prediction(c.req.valid("param").id), meta),
  );
  r.get("/clips", (c) => ok(c, catalog.clips(), meta));
  r.get("/history", (c) => ok(c, catalog.history(), meta));
  r.get("/fantasy", (c) => ok(c, catalog.fantasy(), meta));

  r.get(
    "/search",
    validate("query", z.object({ q: z.string().min(1).max(120) })),
    async (c) => ok(c, await catalog.search(c.req.valid("query").q), meta),
  );

  return r;
}
