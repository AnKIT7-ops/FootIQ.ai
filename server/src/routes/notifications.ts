import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { NotificationService } from "../services/notifications";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";
import { requireUser } from "../middleware/auth";
import { rateLimit, rateLimits } from "../middleware/rate-limit";

export function notificationRoutes(notifications: NotificationService) {
  const r = new Hono<AppEnv>();
  r.use("*", requireUser());
  r.use("*", rateLimit(rateLimits.api));

  r.get(
    "/",
    validate("query", z.object({ unread: z.enum(["true", "false"]).optional() })),
    async (c) =>
      ok(c, await notifications.list(c.get("user")!.id, c.req.valid("query").unread === "true")),
  );

  r.post(
    "/read",
    validate("json", z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })),
    async (c) => {
      await notifications.markRead(c.get("user")!.id, c.req.valid("json").ids);
      return ok(c, { updated: true });
    },
  );

  return r;
}
