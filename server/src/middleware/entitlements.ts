import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { ApiError } from "../lib/errors";
import { PLAN_LIMITS, type Plan } from "../../../shared/contracts";

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
 * Consume one unit of a metered quota (per user, per UTC day) before the
 * handler runs. Backed by Postgres when available (atomic RPC), cache-counter
 * otherwise. Throws quota_exceeded when spent.
 */
export function consumeQuota(metric: "ai_requests" | "searches" | "exports"): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw ApiError.unauthorized();
    const { quota } = c.get("services");
    const limit = quotaLimitFor(metric, user.plan);
    const allowed = await quota.consume(user.id, metric, limit);
    if (!allowed) throw ApiError.quota();
    await next();
  };
}

function quotaLimitFor(metric: "ai_requests" | "searches" | "exports", plan: Plan): number {
  const limits = PLAN_LIMITS[plan];
  switch (metric) {
    case "ai_requests":
      return limits.aiRequestsPerDay;
    case "searches":
      return 500; // generous; exists to stop scripted abuse, not users
    case "exports":
      return 20;
  }
}
