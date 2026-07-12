import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AppEnv } from "../types";
import { ApiError } from "../lib/errors";
import type { Plan, Role, SessionUser } from "../../../shared/contracts";

/**
 * Supabase JWT verification — local crypto, no network round trip per request.
 *  - New Supabase projects sign with asymmetric keys → verify via JWKS
 *    (fetched once, cached by jose).
 *  - Legacy projects sign HS256 with the project JWT secret → set
 *    SUPABASE_JWT_SECRET and we verify against it.
 * Fail closed: any verification error = anonymous request, and protected
 * routes then 401.
 */

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(supabaseUrl: string) {
  let jwks = jwksCache.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksCache.set(supabaseUrl, jwks);
  }
  return jwks;
}

interface SupabaseClaims extends JWTPayload {
  email?: string;
  is_anonymous?: boolean;
  user_metadata?: { name?: string; avatar_url?: string };
  app_metadata?: { role?: string; plan?: string };
}

async function verifyToken(
  token: string,
  supabaseUrl: string | undefined,
  hsSecret: string | undefined,
): Promise<SupabaseClaims | null> {
  try {
    if (hsSecret) {
      const key = new TextEncoder().encode(hsSecret);
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      return payload as SupabaseClaims;
    }
    if (supabaseUrl) {
      const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
        algorithms: ["RS256", "ES256"],
      });
      return payload as SupabaseClaims;
    }
    return null;
  } catch {
    return null; // expired/forged/malformed — treat as unauthenticated
  }
}

function toSessionUser(claims: SupabaseClaims): SessionUser {
  const role = claims.app_metadata?.role === "admin" ? "admin" : "user";
  const planRaw = claims.app_metadata?.plan;
  const plan: Plan = planRaw === "pro" || planRaw === "club" ? planRaw : "free";
  return {
    id: String(claims.sub),
    email: claims.email ?? null,
    role: role as Role,
    plan,
    displayName: claims.user_metadata?.name ?? null,
    avatarUrl: claims.user_metadata?.avatar_url ?? null,
    isAnonymous: claims.is_anonymous === true,
  };
}

/**
 * Attaches `user` (or null) to every request. Never rejects — public routes
 * stay public; gating happens in requireUser/requireRole.
 */
export function optionalAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set("user", null);
    const header = c.req.header("Authorization");
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7);
      const { env } = c.get("services");
      const claims = await verifyToken(token, env.SUPABASE_URL, env.SUPABASE_JWT_SECRET);
      if (claims?.sub) c.set("user", toSessionUser(claims));
    }
    await next();
  };
}

/** 401 unless a verified user (anonymous Supabase sessions count as users). */
export function requireUser(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get("user")) throw ApiError.unauthorized();
    await next();
  };
}

/** 401 if signed out, 403 if signed in without the role. */
export function requireRole(role: "admin"): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw ApiError.unauthorized();
    if (user.role !== role) {
      c.get("logger").warn("authz.denied", { userId: user.id, needed: role });
      throw ApiError.forbidden();
    }
    await next();
  };
}
