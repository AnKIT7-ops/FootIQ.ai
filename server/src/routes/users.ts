import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { UserDataService } from "../services/user-data";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";
import { requireUser } from "../middleware/auth";
import { rateLimit, rateLimits } from "../middleware/rate-limit";
import { PLAN_LIMITS } from "../../../shared/contracts";
import { cleanText } from "../lib/sanitize";

const refId = z.string().min(1).max(64).regex(/^[\w.-]+$/);
const uuid = z.string().uuid();

/** Everything user-owned. All routes require a verified session. */
export function userRoutes(users: UserDataService) {
  const r = new Hono<AppEnv>();
  r.use("*", requireUser());
  r.use("*", rateLimit(rateLimits.write));

  // --- profile
  r.get("/profile", async (c) => ok(c, await users.getProfile(c.get("user")!.id)));
  r.patch(
    "/profile",
    validate(
      "json",
      z.object({
        displayName: z.string().min(1).max(60).optional(),
        favoriteTeam: refId.optional(),
        country: z.string().length(2).optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      await users.updateProfile(c.get("user")!.id, {
        ...(body.displayName ? { display_name: cleanText(body.displayName, 60) } : {}),
        ...(body.favoriteTeam ? { favorite_team: body.favoriteTeam } : {}),
        ...(body.country ? { country: body.country.toUpperCase() } : {}),
      });
      return ok(c, { updated: true });
    },
  );

  // --- favorites
  r.get("/favorites", async (c) => ok(c, await users.listFavorites(c.get("user")!.id)));
  r.put(
    "/favorites",
    validate("json", z.object({ kind: z.enum(["team", "player"]), refId })),
    async (c) => {
      const { kind, refId: rid } = c.req.valid("json");
      await users.addFavorite(c.get("user")!.id, kind, rid);
      return ok(c, { added: true });
    },
  );
  r.delete(
    "/favorites",
    validate("json", z.object({ kind: z.enum(["team", "player"]), refId })),
    async (c) => {
      const { kind, refId: rid } = c.req.valid("json");
      await users.removeFavorite(c.get("user")!.id, kind, rid);
      return ok(c, { removed: true });
    },
  );

  // --- bookmarks
  r.get("/bookmarks", async (c) => ok(c, await users.listBookmarks(c.get("user")!.id)));
  r.put(
    "/bookmarks",
    validate("json", z.object({ kind: z.enum(["news", "match", "player", "team"]), refId })),
    async (c) => {
      const { kind, refId: rid } = c.req.valid("json");
      await users.addBookmark(c.get("user")!.id, kind, rid);
      return ok(c, { added: true });
    },
  );
  r.delete("/bookmarks/:id", validate("param", z.object({ id: uuid })), async (c) => {
    await users.removeBookmark(c.get("user")!.id, c.req.valid("param").id);
    return ok(c, { removed: true });
  });

  // --- tactical boards
  r.get("/boards", async (c) => ok(c, await users.listBoards(c.get("user")!.id)));
  r.put(
    "/boards",
    validate(
      "json",
      z.object({
        id: uuid.optional(),
        name: z.string().min(1).max(80),
        formation: z.string().min(3).max(20),
        state: z.unknown(),
      }),
    ),
    async (c) => {
      const user = c.get("user")!;
      const body = c.req.valid("json");
      const boardId = await users.saveBoard(
        user.id,
        { ...body, name: cleanText(body.name, 80) },
        PLAN_LIMITS[user.plan].savedBoards,
      );
      return ok(c, { id: boardId });
    },
  );
  r.delete("/boards/:id", validate("param", z.object({ id: uuid })), async (c) => {
    await users.deleteBoard(c.get("user")!.id, c.req.valid("param").id);
    return ok(c, { removed: true });
  });

  // --- saved comparisons
  r.get("/comparisons", async (c) => ok(c, await users.listComparisons(c.get("user")!.id)));
  r.post(
    "/comparisons",
    validate(
      "json",
      z.object({ playerIds: z.array(refId).min(2).max(4), note: z.string().max(500).nullish() }),
    ),
    async (c) => {
      const user = c.get("user")!;
      const body = c.req.valid("json");
      const id = await users.saveComparison(
        user.id,
        body.playerIds,
        body.note ? cleanText(body.note, 500) : null,
        PLAN_LIMITS[user.plan].savedComparisons,
      );
      return ok(c, { id });
    },
  );
  r.delete("/comparisons/:id", validate("param", z.object({ id: uuid })), async (c) => {
    await users.deleteComparison(c.get("user")!.id, c.req.valid("param").id);
    return ok(c, { removed: true });
  });

  return r;
}

/** /api/settings — split out so the path stays flat and cache rules obvious. */
export function settingsRoutes(users: UserDataService) {
  const r = new Hono<AppEnv>();
  r.use("*", requireUser());
  r.use("*", rateLimit(rateLimits.write));

  r.get("/", async (c) => ok(c, await users.getSettings(c.get("user")!.id)));
  r.patch(
    "/",
    validate(
      "json",
      z.object({
        theme: z.enum(["dark", "light", "system"]).optional(),
        language: z.string().min(2).max(8).optional(),
        emailNews: z.boolean().optional(),
        emailMatchAlerts: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid("json");
      await users.updateSettings(c.get("user")!.id, {
        ...(b.theme ? { theme: b.theme } : {}),
        ...(b.language ? { language: b.language } : {}),
        ...(b.emailNews !== undefined ? { email_news: b.emailNews } : {}),
        ...(b.emailMatchAlerts !== undefined ? { email_match_alerts: b.emailMatchAlerts } : {}),
      });
      return ok(c, { updated: true });
    },
  );

  return r;
}
