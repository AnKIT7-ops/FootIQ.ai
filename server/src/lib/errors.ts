import { ERROR_STATUS, type ApiErrorCode } from "../../../shared/contracts";

/**
 * The only error type routes/services should throw for expected failures.
 * The global error handler maps it to the response envelope; anything else
 * becomes an opaque 500 (never leak internals to clients).
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  /** Extra context for logs only — never serialized to the client. */
  readonly internal?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    opts?: { details?: Record<string, string[]>; internal?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = opts?.details;
    this.internal = opts?.internal;
  }

  static notFound(what = "Resource"): ApiError {
    return new ApiError("not_found", `${what} not found.`);
  }
  static unauthorized(message = "Authentication required."): ApiError {
    return new ApiError("unauthorized", message);
  }
  static forbidden(message = "You don't have access to this."): ApiError {
    return new ApiError("forbidden", message);
  }
  static rateLimited(message = "Too many requests. Slow down and retry shortly."): ApiError {
    return new ApiError("rate_limited", message);
  }
  static quota(message = "Daily quota reached for your plan."): ApiError {
    return new ApiError("quota_exceeded", message);
  }
  static unavailable(message = "This feature isn't configured on this deployment."): ApiError {
    return new ApiError("service_unavailable", message);
  }
}
