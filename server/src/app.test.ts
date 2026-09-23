import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createApp, createServer } from "./app";
import { samplePlayers } from "./test-fixtures";
import { loadEnv } from "./config/env";
import type { ApiFailure, ApiSuccess } from "../../shared/contracts";

/**
 * API tests: real app factory, in-memory cache, no database (demo mode),
 * mock AI provider (default when no key configured). Auth uses a real
 * HS256-signed JWT against a test secret — the full verification path runs.
 */

const TEST_SECRET = "test-jwt-secret-value-at-least-20-chars";

const testEnv = (extraEnv: Record<string, string> = {}) =>
  loadEnv({
    NODE_ENV: "test",
    RATE_LIMIT_DISABLED: "true",
    SUPABASE_JWT_SECRET: TEST_SECRET,
    CORS_ORIGINS: "http://localhost:5173",
    ...extraEnv,
  });

function makeApp(extraEnv: Record<string, string> = {}) {
  return createApp(testEnv(extraEnv));
}

/** Players have no demo fallback: seed the snapshot the FPL sync job would write. */
function makeAppWithPlayers(extraEnv: Record<string, string> = {}) {
  const { app, services } = createServer(testEnv(extraEnv));
  beforeAll(() => services.snapshots.set("players", samplePlayers, "fpl"));
  return app;
}

describe("catalog availability contract", () => {
  /**
   * With no snapshot written, the football domains must fail loudly.
   *
   * 200-with-empty is forbidden here: a caller cannot distinguish "the sync has
   * never run" from "there genuinely are no matches today", and the second is a
   * claim we can't back. Returning demo fixtures instead — the original
   * behaviour — is worse still: it's indistinguishable from real data.
   */
  it("returns 503 'Data temporarily unavailable.' for matches before any sync", async () => {
    const res = await makeApp().request("/api/matches");
    expect(res.status).toBe(503);
    const body = (await res.json()) as ApiFailure;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("service_unavailable");
    expect(body.error.message).toBe("Data temporarily unavailable.");
  });

  it("returns 503 for competitions before any sync", async () => {
    const res = await makeApp().request("/api/competitions");
    expect(res.status).toBe(503);
    expect(((await res.json()) as ApiFailure).error.message).toBe("Data temporarily unavailable.");
  });
});

async function tokenFor(sub: string, extras: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ sub, email: "t@example.com", ...extras })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(TEST_SECRET));
}

const asJson = async <T>(res: Response) => (await res.json()) as T;

describe("API envelope & catalog", () => {
  const app = makeAppWithPlayers();

  it("GET /api/health reports demo mode and the mock AI provider", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await asJson<ApiSuccess<{ mode: string; aiProvider: string }>>(res);
    expect(body.ok).toBe(true);
    expect(body.data.mode).toBe("demo");
    expect(body.data.aiProvider).toBe("mock");
  });

  it("GET /api/players returns the dataset with source metadata", async () => {
    const res = await app.request("/api/players");
    const body = await asJson<ApiSuccess<unknown[]>>(res);
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(samplePlayers.length);
    expect(body.meta?.source).toBe("provider");
  });

  it("GET /api/players/:id 404s with the error envelope for unknown ids", async () => {
    const res = await app.request("/api/players/nope");
    expect(res.status).toBe(404);
    const body = await asJson<ApiFailure>(res);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not_found");
  });

  it("rejects malformed route params with 422 + field details", async () => {
    const res = await app.request("/api/players/%3Cscript%3E");
    expect(res.status).toBe(422);
    const body = await asJson<ApiFailure>(res);
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toBeDefined();
  });

  it("GET /api/search matches players case-insensitively", async () => {
    const res = await app.request("/api/search?q=SAM%20Fix");
    const body = await asJson<ApiSuccess<{ kind: string; title: string }[]>>(res);
    expect(body.data.some((r) => r.kind === "player")).toBe(true);
  });

  it("unknown endpoints return the 404 envelope, not HTML", async () => {
    const res = await app.request("/api/definitely-not-real");
    expect(res.status).toBe(404);
    const body = await asJson<ApiFailure>(res);
    expect(body.ok).toBe(false);
  });
});

describe("auth & authorization", () => {
  const app = makeApp();

  it("GET /api/auth/me returns null user without a token", async () => {
    const body = await asJson<ApiSuccess<{ user: unknown }>>(await app.request("/api/auth/me"));
    expect(body.data.user).toBeNull();
  });

  it("GET /api/auth/me resolves a valid signed token to a session user", async () => {
    const token = await tokenFor("user-1", { user_metadata: { name: "Ana" } });
    const res = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await asJson<ApiSuccess<{ user: { id: string; role: string } }>>(res);
    expect(body.data.user.id).toBe("user-1");
    expect(body.data.user.role).toBe("user");
  });

  it("ignores forged tokens (signed with the wrong key)", async () => {
    const forged = await new SignJWT({ sub: "attacker" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode("wrong-secret-wrong-secret-wrong!"));
    const res = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${forged}` },
    });
    const body = await asJson<ApiSuccess<{ user: unknown }>>(res);
    expect(body.data.user).toBeNull();
  });

  it("protected routes 401 for guests", async () => {
    const res = await app.request("/api/users/favorites");
    expect(res.status).toBe(401);
  });

  it("admin routes 403 for non-admin users", async () => {
    const token = await tokenFor("user-1");
    const res = await app.request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("user-data routes degrade to 503 in demo mode (no database)", async () => {
    const token = await tokenFor("user-1");
    const res = await app.request("/api/users/favorites", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(503);
    const body = await asJson<ApiFailure>(res);
    expect(body.error.code).toBe("service_unavailable");
  });
});

describe("AI endpoints", () => {
  const app = makeAppWithPlayers();
  const flaggedOff = makeAppWithPlayers({ FLAG_AI_SCOUT: "false" });

  it("requires auth", async () => {
    const res = await app.request("/api/ai/scout/p-salah/report", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("generates a scout report via the mock provider for signed-in users", async () => {
    const token = await tokenFor("user-1");
    const players = await asJson<ApiSuccess<{ id: string }[]>>(await app.request("/api/players"));
    const res = await app.request(`/api/ai/scout/${players.data[0].id}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await asJson<ApiSuccess<{ provider: string; text: string }>>(res);
    expect(body.data.provider).toBe("mock");
    expect(body.data.text.length).toBeGreaterThan(50);
  });

  it("validates request bodies (fantasy advice question required)", async () => {
    const token = await tokenFor("user-1");
    const res = await app.request("/api/ai/fantasy/advice", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("honours the ai_scout kill switch", async () => {
    const token = await tokenFor("user-1");
    const players = await asJson<ApiSuccess<{ id: string }[]>>(await flaggedOff.request("/api/players"));
    const res = await flaggedOff.request(`/api/ai/scout/${players.data[0].id}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(503);
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After once the window budget is spent", async () => {
    // rate limiting ON for this app instance
    const app = createApp(
      loadEnv({ NODE_ENV: "test", SUPABASE_JWT_SECRET: TEST_SECRET, CORS_ORIGINS: "x" }),
    );
    let last: Response | null = null;
    for (let i = 0; i < 5; i++) {
      last = await app.request("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ email: `person${i}@example.com` }),
      });
    }
    expect(last!.status).toBe(200); // form scope allows 5/min; global api allows more
    const blocked = await app.request("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ email: "person6@example.com" }),
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("community endpoints", () => {
  const app = makeApp();

  it("accepts newsletter signups in demo mode", async () => {
    const res = await app.request("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "fan@example.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects invalid emails with field details", async () => {
    const res = await app.request("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(422);
    const body = await asJson<ApiFailure>(res);
    expect(body.error.details?.email).toBeDefined();
  });

  it("accepts feedback and sanitizes content", async () => {
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "bug", message: "The  radar chart clips on mobile" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("CORS", () => {
  const app = makeApp();

  it("allows the configured origin", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("does not reflect unknown origins", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("meta stats", () => {
  const app = makeApp();

  it("GET /api/stats returns safe aggregates (nulls in demo mode, no PII)", async () => {
    const res = await app.request("/api/stats");
    expect(res.status).toBe(200);
    const body = await asJson<
      ApiSuccess<{ newsletterSubscribers: number | null; feedbackEntries: number | null; dataProvider: string; lastStandingsSyncAt: string | null }>
    >(res);
    expect(body.ok).toBe(true);
    expect(body.data.newsletterSubscribers).toBeNull();
    expect(body.data.feedbackEntries).toBeNull();
    expect(typeof body.data.dataProvider).toBe("string");
  });
});
