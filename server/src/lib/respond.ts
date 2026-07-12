import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiFailure, ApiMeta, ApiSuccess } from "../../../shared/contracts";
import type { ApiError } from "./errors";

/** Success envelope. */
export function ok<T>(c: Context, data: T, meta?: ApiMeta): Response {
  const body: ApiSuccess<T> = { ok: true, data, ...(meta ? { meta } : {}) };
  return c.json(body);
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
