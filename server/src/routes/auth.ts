import { Hono } from "hono";
import type { AppEnv } from "../types";
import { ok } from "../lib/respond";
import { requireUser } from "../middleware/auth";
import { clientIp, rateLimit, rateLimits } from "../middleware/rate-limit";
import { hashIp } from "../lib/sanitize";

/**
 * Auth support routes. Sign-in itself happens directly between the browser
 * and Supabase (email OTP / Google OAuth / anonymous) — the server never
 * sees passwords. These endpoints answer "who am I according to my token"
 * and record session-start events for the audit trail.
 */
export function authRoutes() {
  const r = new Hono<AppEnv>();
  r.use("*", rateLimit(rateLimits.auth));

  /** Verified identity from the bearer token, or user: null for guests. */
  r.get("/me", (c) => ok(c, { user: c.get("user") }));

  /** Client calls this once after a successful sign-in — audit + welcome hooks. */
  r.post("/session", requireUser(), async (c) => {
    const user = c.get("user")!;
    const { audit, env } = c.get("services");
    const ip = clientIp(c);
    audit.log({
      actorId: user.id,
      action: "auth.session_started",
      detail: { anonymous: user.isAnonymous },
      ipHash: await hashIp(ip, env.IP_HASH_SALT),
    });
    return ok(c, { user });
  });

  return r;
}
