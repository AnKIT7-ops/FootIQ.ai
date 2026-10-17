import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiFailure, ApiMeta, ApiSuccess } from "../../../shared/contracts";
import type { ApiError } from "./errors";

/** Success envelope. */
export function ok<T>(c: Context, data: T, meta?: ApiMeta): Response {
  const body: ApiSuccess<T> = { ok: true, data, ...(meta ? { meta } : {}) };
  return c.json(body);
}

/**
 * Mark a response shareable: browsers AND shared caches (a CDN in front of
 * the Worker, e.g. a Vercel rewrite) may keep it for `seconds`, then serve it
 * stale for as long again while refetching, and up to a day if the origin is
 * failing. Only for payloads identical for every caller — anything else falls
 * through to the `private, no-store` default in app.ts. Never call it on a
 * route whose output depends on the user.
 */
export function publicCache(c: Context, seconds: number): void {
  c.header(
    "Cache-Control",
    `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${seconds}, stale-if-error=86400`,
  );
}

/** Failure envelope from a typed ApiError. */
export function fail(c: Context, err: ApiError, requestId?: string): Response {
  const body: ApiFailure = {
    ok: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
    ...(requestId ? { meta: { requestId } } : {}),
  };
  return c.json(body, err.status as ContentfulStatusCode);
}
