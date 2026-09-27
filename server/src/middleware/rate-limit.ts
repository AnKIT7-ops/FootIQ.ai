import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { ApiError } from "../lib/errors";
import { cacheKeys } from "../cache/types";
import { hashIp } from "../lib/sanitize";

export interface RateLimitOptions {
  /** Bucket name — separate budgets per surface ("api", "auth", "ai", "write"). */
  scope: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds (fixed window). */
  windowSeconds: number;
  /** Also key signed-in users by IP; over either budget = rejected. */
  perIp?: boolean;
}

/**
 * Fixed-window limiter on the shared cache. Identity = user id when signed
 * in (plus hashed IP for perIp scopes), hashed IP otherwise. Fixed window
 * (vs sliding) is deliberate: one INCR per request keeps free-tier cache command budgets intact, and the worst
 * case (2x burst at a window boundary) is acceptable for our thresholds.
 */
/** Env override per scope (RATE_LIMIT_API=600 etc.); unset = preset default. */
function effectiveLimit(scope: string, preset: number, env: { RATE_LIMIT_API?: number; RATE_LIMIT_WRITES?: number; RATE_LIMIT_AUTH?: number; RATE_LIMIT_AI?: number; RATE_LIMIT_FORMS?: number }): number {
  switch (scope) {
    case "api": return env.RATE_LIMIT_API ?? preset;
    case "write": return env.RATE_LIMIT_WRITES ?? preset;
    case "auth": return env.RATE_LIMIT_AUTH ?? preset;
    case "ai": return env.RATE_LIMIT_AI ?? preset;
    case "form": return env.RATE_LIMIT_FORMS ?? preset;
    default: return preset;
  }
}

/**
 * Client IP. Workers: cf-connecting-ip, which Cloudflare sets itself. Node:
 * the socket peer — or, with TRUST_PROXY, the rightmost X-Forwarded-For entry
 * (the one our proxy appended; everything left of it is client-supplied).
 */
export function clientIp(c: Context<AppEnv>): string {
  const peer = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket
    ?.remoteAddress;
  if (peer) {
    const proxied = c.get("services").env.TRUST_PROXY
      ? c.req.header("x-forwarded-for")?.split(",").pop()?.trim()
      : undefined;
    return proxied || peer;
  }
  return c.req.header("cf-connecting-ip") ?? "0.0.0.0";
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const { cache, env } = c.get("services");
    if (env.RATE_LIMIT_DISABLED) return next();
    const limit = effectiveLimit(opts.scope, opts.limit, env);

    const user = c.get("user");
    const ipId = `ip:${await hashIp(clientIp(c), env.IP_HASH_SALT)}`;
    // perIp: signed-in users are ALSO counted against their IP, so minting
    // fresh (e.g. anonymous) identities doesn't mint fresh budgets.
    const ids = !user ? [ipId] : opts.perIp ? [`u:${user.id}`, ipId] : [`u:${user.id}`];

    const windowStart = Math.floor(Date.now() / 1000 / opts.windowSeconds) * opts.windowSeconds;
    const counts = await Promise.all(
      ids.map((id) => cache.increment(cacheKeys.rate(opts.scope, id, windowStart), opts.windowSeconds)),
    );
    const count = Math.max(...counts);
    const id = ids[counts.indexOf(count)];

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));

    if (count > limit) {
      c.get("logger").warn("rate_limit.exceeded", { scope: opts.scope, id, count });
      c.header("Retry-After", String(opts.windowSeconds));
      throw ApiError.rateLimited();
    }
    await next();
  };
}

/** Shared presets so budgets live in one place. */
export const rateLimits = {
  /** General read traffic. */
  api: { scope: "api", limit: 300, windowSeconds: 60 },
  /** Anything that writes. */
  write: { scope: "write", limit: 60, windowSeconds: 60 },
  /** Auth endpoints — brute-force target, keep tight. */
  auth: { scope: "auth", limit: 10, windowSeconds: 60 },
  /** AI generation — expensive upstream. */
  ai: { scope: "ai", limit: 10, windowSeconds: 60, perIp: true },
  /** Public form posts (newsletter, feedback). */
  form: { scope: "form", limit: 5, windowSeconds: 60 },
} satisfies Record<string, RateLimitOptions>;
