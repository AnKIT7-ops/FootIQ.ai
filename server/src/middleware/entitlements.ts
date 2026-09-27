import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { ApiError } from "../lib/errors";
import { GUEST_AI_REQUESTS_PER_DAY, PLAN_LIMITS, type Plan, type SessionUser } from "../../../shared/contracts";

const PLAN_ORDER: Record<Plan, number> = { free: 0, pro: 1, club: 2 };

/**
 * Premium foundation — feature gating without payments. When Stripe/Razorpay
 * lands, the only change is how `profiles.plan` gets set (webhook); every
 * gate below keeps working untouched.
 */
export function requirePlan(min: Plan): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw ApiError.unauthorized();
    if (PLAN_ORDER[user.plan] < PLAN_ORDER[min]) {
      throw new ApiError("forbidden", `This feature needs the ${min} plan.`);
    }
    await next();
  };
}

/**
 * Per-user daily AI allowance, as a charge for `ai.run(prompt, { charge })`.
 * AiService calls it only on a cache miss, so cached answers are free. Backed
 * by Postgres when available (atomic RPC), cache-counter otherwise. Throws
 * quota_exceeded when spent.
 */
export function aiCharge(c: Context<AppEnv>): () => Promise<void> {
  return async () => {
    const user = c.get("user");
    if (!user) throw ApiError.unauthorized();
    const allowed = await c.get("services").quota.consume(user.id, "ai_requests", aiRequestsPerDay(user));
    if (!allowed) throw ApiError.quota();
  };
}

function aiRequestsPerDay(user: SessionUser): number {
  const limit = PLAN_LIMITS[user.plan].aiRequestsPerDay;
  return user.isAnonymous ? Math.min(limit, GUEST_AI_REQUESTS_PER_DAY) : limit;
}
