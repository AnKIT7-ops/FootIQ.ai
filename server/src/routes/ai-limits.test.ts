import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "../app";
import { loadEnv } from "../config/env";
import { AiService } from "../ai/service";
import { MemoryCache } from "../cache/memory";
import { createLogger } from "../lib/logger";
import type { AiProvider } from "../ai/types";
import type { ApiFailure } from "../../../shared/contracts";

/** The abuse limits on the shared AI key: global ceiling, guest allowance, per-IP rate, free cache hits. */

const SECRET = "test-jwt-secret-value-at-least-20-chars";

function counting() {
  const calls = { n: 0 };
  const provider: AiProvider = {
    name: "gemini",
    complete: async () => {
      calls.n++;
      return { text: "An answer from the data FootIQ holds.", model: "stub" };
    },
  };
  return { provider, calls };
}

function appWith(provider: AiProvider, opts: { globalLimit?: number; env?: Record<string, string> } = {}) {
  return createApp(
    loadEnv({ NODE_ENV: "test", RATE_LIMIT_DISABLED: "true", SUPABASE_JWT_SECRET: SECRET, CORS_ORIGINS: "x", ...opts.env }),
    { services: { ai: new AiService(provider, new MemoryCache(), createLogger("error"), null, opts.globalLimit) } },
  );
}

async function ask(
  app: ReturnType<typeof createApp>,
  question: string,
  who: { sub?: string; anonymous?: boolean; ip?: string } = {},
) {
  const token = await new SignJWT({ sub: who.sub ?? "u1", ...(who.anonymous ? { is_anonymous: true } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(SECRET));
  return app.request("/api/ai/ask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(who.ip ? { "cf-connecting-ip": who.ip } : {}),
    },
    body: JSON.stringify({ question }),
  });
}

const errorOf = async (res: Response) => ((await res.json()) as ApiFailure).error;

describe("AI abuse limits", () => {
  it("global ceiling blocks the N+1th real generation but still serves cache hits", async () => {
    const { provider, calls } = counting();
    const app = appWith(provider, { globalLimit: 2 });
    expect((await ask(app, "Question one", { sub: "a" })).status).toBe(200);
    expect((await ask(app, "Question two", { sub: "b" })).status).toBe(200);

    const blocked = await ask(app, "Question three", { sub: "c" });
    expect(blocked.status).toBe(429);
    expect((await errorOf(blocked)).message).toMatch(/daily AI allowance is used up/);

    expect((await ask(app, "Question one", { sub: "d" })).status).toBe(200); // cached
    expect(calls.n).toBe(2);
  });

  it("gives anonymous sessions a smaller daily allowance than signed-up users", async () => {
    const app = appWith(counting().provider);
    for (let i = 0; i < 3; i++) expect((await ask(app, `Guest q${i}`, { sub: "guest", anonymous: true })).status).toBe(200);
    const blocked = await ask(app, "Guest q3", { sub: "guest", anonymous: true });
    expect(blocked.status).toBe(429);
    expect((await errorOf(blocked)).code).toBe("quota_exceeded");

    for (let i = 0; i < 4; i++) expect((await ask(app, `Member q${i}`, { sub: "member" })).status).toBe(200);
  });

  it("rate-limits the ai scope by IP across rotating user ids", async () => {
    const app = createApp(
      loadEnv({ NODE_ENV: "test", SUPABASE_JWT_SECRET: SECRET, CORS_ORIGINS: "x", RATE_LIMIT_AI: "3" }),
      { services: { ai: new AiService(counting().provider, new MemoryCache(), createLogger("error")) } },
    );
    for (let i = 0; i < 3; i++) expect((await ask(app, `q${i}`, { sub: `anon-${i}`, ip: "203.0.113.7" })).status).toBe(200);
    expect((await ask(app, "q3", { sub: "anon-3", ip: "203.0.113.7" })).status).toBe(429);
    expect((await ask(app, "q4", { sub: "anon-4", ip: "198.51.100.2" })).status).toBe(200);
  });

  it("keeps endpoints the frontend never calls behind experimental_ai (off by default)", async () => {
    const token = await new SignJWT({ sub: "u1" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(SECRET));
    const res = await appWith(counting().provider).request("/api/ai/tactics/feedback", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ formation: "4-3-3" }),
    });
    expect(res.status).toBe(503);
  });

  it("does not charge the user's quota for cached answers", async () => {
    const { provider, calls } = counting();
    const app = appWith(provider);
    for (let i = 0; i < 6; i++) expect((await ask(app, "Same question", { sub: "guest", anonymous: true })).status).toBe(200);
    expect(calls.n).toBe(1);
    // Only one of the guest's 3 units was spent above.
    expect((await ask(app, "New question A", { sub: "guest", anonymous: true })).status).toBe(200);
    expect((await ask(app, "New question B", { sub: "guest", anonymous: true })).status).toBe(200);
    expect((await ask(app, "New question C", { sub: "guest", anonymous: true })).status).toBe(429);
  });
});
