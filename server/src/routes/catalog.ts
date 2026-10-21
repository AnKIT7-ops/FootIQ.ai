import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { CatalogService } from "../services/catalog";
import { ok, publicCache } from "../lib/respond";
import { validate } from "../middleware/validate";

const idParam = z.object({ id: z.string().min(1).max(64).regex(/^[\w.-]+$/) });

/**
 * Read-only football catalog. Public (the product's read surface is free);
 * global + per-scope rate limits applied in app.ts. Snapshot-backed domains
 * report their true source per response ("provider" after a sync, "demo"
 * otherwise) so ops can always tell what served a payload.
 *
 * Every route here returns the same bytes to every caller, so every route
 * opts into shared caching via publicCache(). Errors are forced back to
 * no-store in app.ts regardless.
 */
export function catalogRoutes(catalog: CatalogService) {
  const r = new Hono<AppEnv>();
  const demoMeta = { source: "demo" as const };
  // Bundled demo datasets change only on deploy.
  const DEMO = 3600;

  // Real Premier League players (FPL sync, hourly). ~340 KB raw, ~50 KB gzipped.
  r.get("/players", async (c) => {
    const { data, syncedAt } = await catalog.players();
    publicCache(c, 900);
    return ok(c, data, { source: "provider", syncedAt });
  });
  r.get("/players/:id", validate("param", idParam), async (c) => {
    const player = await catalog.player(c.req.valid("param").id);
    publicCache(c, 900);
    return ok(c, player, { source: "provider" });
  });

  // Cache-Control by volatility, matching the sync cadence behind each domain:
  // club identity is re-fetched daily, tables every 30 minutes, live scores
  // every 30 seconds (see /matches). A longer max-age than the sync interval
  // would serve data the sync has already superseded.
  r.get("/teams", async (c) => {
    const { data, source } = await catalog.teams();
    publicCache(c, 86400);
    return ok(c, data, { source });
  });
  /**
   * Competitions and their current-season state (season dates, matchday).
   * Cached hard: this changes at most once a day.
   */
  r.get("/competitions", async (c) => {
    const { data, source, syncedAt } = await catalog.competitions();
    publicCache(c, 86400);
    return ok(c, data, { source, syncedAt });
  });

  /** Competition NAMES present in the team snapshot — the table's league picker reads this. */
  r.get("/teams/competitions", async (c) => {
    const { data, source } = await catalog.competitionNames();
    publicCache(c, 900);
    return ok(c, data, { source });
  });
  // Every row carries its own `league`, so the resolved competition needs no
  // separate envelope field — read it off data[0].league.
  r.get(
    "/teams/table",
    validate("query", z.object({ competition: z.string().min(1).max(80).optional() })),
    async (c) => {
      const { data, source } = await catalog.leagueTable(c.req.valid("query").competition);
      publicCache(c, 900);
      return ok(c, data, { source });
    },
  );
  r.get("/teams/:id", validate("param", idParam), async (c) => {
    const { data, source } = await catalog.team(c.req.valid("param").id);
    publicCache(c, 900);
    return ok(c, data, { source });
  });
  r.get("/teams/:id/players", validate("param", idParam), async (c) => {
    const players = await catalog.teamPlayers(c.req.valid("param").id);
    publicCache(c, 900);
    return ok(c, players, { source: "provider" });
  });

  /**
   * Fixtures. Cache-Control is split by content: a live match's minute and
   * score go stale in seconds, everything else changes only when a sync runs.
   * `syncedAt` lets a client tell "no matches today" from "nothing synced".
   */
  r.get("/matches", async (c) => {
    const { data, source, syncedAt } = await catalog.matches();
    publicCache(c, data.live.length > 0 ? 30 : 300);
    return ok(c, data, { source, syncedAt });
  });
  r.get("/matches/:id", validate("param", idParam), async (c) => {
    const { data, source } = await catalog.match(c.req.valid("param").id);
    publicCache(c, data.status === "live" ? 30 : 300);
    return ok(c, data, { source });
  });

  /** Real headlines (RSS, synced every 30 minutes). */
  r.get("/headlines", async (c) => {
    const { data, syncedAt } = await catalog.headlines();
    publicCache(c, 300);
    return ok(c, data, { source: "provider", syncedAt });
  });
  r.get("/news", (c) => {
    publicCache(c, DEMO);
    return ok(c, catalog.news(), demoMeta);
  });
  r.get("/news/:id", validate("param", idParam), (c) => {
    const article = catalog.article(c.req.valid("param").id);
    publicCache(c, DEMO);
    return ok(c, article, demoMeta);
  });

  r.get("/predictions", (c) => {
    publicCache(c, DEMO);
    return ok(c, catalog.predictions(), demoMeta);
  });
  r.get("/predictions/:id", validate("param", idParam), (c) => {
    const prediction = catalog.prediction(c.req.valid("param").id);
    publicCache(c, DEMO);
    return ok(c, prediction, demoMeta);
  });
  r.get("/history", (c) => {
    publicCache(c, DEMO);
    return ok(c, catalog.history(), demoMeta);
  });
  r.get("/fantasy", async (c) => {
    const { data, syncedAt } = await catalog.fantasy();
    publicCache(c, 900);
    return ok(c, data, { source: "provider", syncedAt });
  });

  r.get(
    "/search",
    validate("query", z.object({ q: z.string().min(1).max(120) })),
    async (c) => {
      const results = await catalog.search(c.req.valid("query").q);
      publicCache(c, 300);
      return ok(c, results);
    },
  );
  r.get(
    "/search/suggest",
    validate("query", z.object({ q: z.string().min(1).max(60) })),
    async (c) => {
      const results = await catalog.suggest(c.req.valid("query").q);
      publicCache(c, 300);
      return ok(c, results);
    },
  );

  return r;
}
