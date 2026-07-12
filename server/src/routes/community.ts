import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { CommunityService } from "../services/community";
import { ok } from "../lib/respond";
import { validate } from "../middleware/validate";
import { rateLimit, rateLimits } from "../middleware/rate-limit";
import { ApiError } from "../lib/errors";
import { isValidEmail } from "../lib/sanitize";

const email = z.string().max(254).refine(isValidEmail, "Enter a valid email address.");

/** Public write surface: newsletter + feedback + feature requests. Tightly rate-limited. */
export function communityRoutes(community: CommunityService) {
  const r = new Hono<AppEnv>();
  r.use("*", rateLimit(rateLimits.form));

  r.post(
    "/newsletter/subscribe",
    validate(
      "json",
      z.object({ email, source: z.enum(["waitlist", "footer", "settings"]).default("waitlist") }),
    ),
    async (c) => {
      const { flags } = c.get("services");
      if (!(await flags.isEnabled("newsletter"))) {
        throw ApiError.unavailable("Signups are paused right now.");
      }
      const body = c.req.valid("json");
      await community.subscribe(body.email, body.source);
      return ok(c, { subscribed: true });
    },
  );

  r.post("/newsletter/unsubscribe", validate("json", z.object({ email })), async (c) => {
    await community.unsubscribe(c.req.valid("json").email);
    return ok(c, { unsubscribed: true });
  });

  r.post(
    "/feedback",
    validate(
      "json",
      z.object({
        email: email.nullish(),
        category: z.enum(["general", "bug", "data", "ai"]).default("general"),
        message: z.string().min(3).max(4000),
        page: z.string().max(200).nullish(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      await community.submitFeedback({
        userId: c.get("user")?.id ?? null,
        email: body.email ?? null,
        category: body.category,
        message: body.message,
        page: body.page ?? null,
      });
      return ok(c, { received: true });
    },
  );

  r.post(
    "/feature-requests",
    validate(
      "json",
      z.object({ title: z.string().min(3).max(120), description: z.string().max(4000).nullish() }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      await community.submitFeatureRequest({
        userId: c.get("user")?.id ?? null,
        title: body.title,
        description: body.description ?? null,
      });
      return ok(c, { received: true });
    },
  );

  return r;
}
