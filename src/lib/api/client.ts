import type { ApiErrorCode, ApiResponse } from "@shared/contracts";
import { backendConfigured, config } from "@/lib/config";
import { noteMeta } from "@/lib/freshness";

/**
 * The frontend's only HTTP door to the backend. Repositories call this;
 * pages never do. Design goals:
 *   * unconfigured or unreachable backend throws ApiUnavailableError fast,
 *     which repositories catch to fall back to demo data — the UI never
 *     knows the difference (graceful degradation requirement);
 *   * every response is the shared envelope, parsed and unwrapped here;
 *   * auth tokens are injected via a registered getter so this module has
 *     no import cycle with the auth layer.
 */

export class ApiUnavailableError extends Error {
  constructor(message = "Backend not reachable") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export class ApiRequestError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status: number,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter = async () => null;

/** Called once by the auth layer at boot. */
export function registerAuthTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  if (!backendConfigured) throw new ApiUnavailableError("VITE_API_URL not set");

  const token = await tokenGetter().catch(() => null);
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // network failure, DNS, timeout — all mean "fall back to demo"
    throw new ApiUnavailableError();
  }

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiUnavailableError("Malformed API response");
  }

  if (!body.ok) {
    // 5xx/502 are availability problems (fall back); 4xx are real answers (surface)
    if (res.status >= 500) throw new ApiUnavailableError(body.error.message);
    throw new ApiRequestError(body.error.code, body.error.message, res.status, body.error.details);
  }
  noteMeta(body.meta);
  return body.data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, payload?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: payload === undefined ? undefined : JSON.stringify(payload) }),
  put: <T>(path: string, payload?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(payload) }),
  patch: <T>(path: string, payload?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: <T>(path: string, payload?: unknown) =>
    apiFetch<T>(path, {
      method: "DELETE",
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
};
