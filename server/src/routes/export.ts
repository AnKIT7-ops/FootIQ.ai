import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { CatalogService } from "../services/catalog";
import { validate } from "../middleware/validate";
import { rateLimit, rateLimits } from "../middleware/rate-limit";

const idParam = z.object({ id: z.string().min(1).max(64).regex(/^[\w.-]+$/) });

const attachment = (c: { header: (k: string, v: string) => void }, filename: string) => {
  c.header("Content-Type", "application/json; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
};

/**
 * Report exports — JSON documents with provenance headers. PNG share cards
 * render client-side (lib/share.ts) and PDF is the browser's print pipeline
 * over the report pages; this endpoint is the machine-readable third format.
 */
export function exportRoutes(catalog: CatalogService) {
  const r = new Hono<AppEnv>();
  r.use("*", rateLimit(rateLimits.write));

  const envelope = (kind: string, data: unknown, source: string) => ({
    exportedAt: new Date().toISOString(),
    generator: "FootIQ export API v1",
    disclaimer: "Includes AI/model-derived fields — analysis, not verified fact.",
    kind,
    source,
    data,
  });

  r.get("/players/:id", validate("param", idParam), async (c) => {
    const player = await catalog.player(c.req.valid("param").id);
    attachment(c, `footiq-player-${player.id}.json`);
    return c.body(JSON.stringify(envelope("player-report", player, "provider"), null, 2));
  });

  r.get("/teams/:id", validate("param", idParam), async (c) => {
    const { data: team, source } = await catalog.team(c.req.valid("param").id);
    attachment(c, `footiq-team-${team.id}.json`);
    return c.body(JSON.stringify(envelope("team-report", team, source), null, 2));
  });

  r.get("/predictions/:id", validate("param", idParam), (c) => {
    const prediction = catalog.prediction(c.req.valid("param").id);
    attachment(c, `footiq-prediction-${c.req.valid("param").id}.json`);
    return c.body(JSON.stringify(envelope("prediction-report", prediction, "demo"), null, 2));
  });

  r.get(
    "/comparison",
    validate("query", z.object({ ids: z.string().max(300) })),
    async (c) => {
      const ids = c.req.valid("query").ids.split(",").map((s) => s.trim()).filter((s) => /^[\w.-]{1,64}$/.test(s)).slice(0, 4);
      const players = await Promise.all(ids.map((id) => catalog.player(id)));
      attachment(c, `footiq-comparison-${ids.join("-vs-")}.json`);
      return c.body(JSON.stringify(envelope("comparison-report", players, "provider"), null, 2));
    },
  );

  return r;
}
