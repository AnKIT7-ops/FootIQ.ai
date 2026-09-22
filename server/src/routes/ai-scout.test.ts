import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "../app";
import { loadEnv } from "../config/env";
import { AiService } from "../ai/service";
import { MemoryCache } from "../cache/memory";
import { createLogger } from "../lib/logger";
import type { AiProvider } from "../ai/types";
import type { ApiFailure, ApiSuccess, ScoutFilters } from "../../../shared/contracts";

const SECRET = "test-jwt-secret-value-at-least-20-chars";

/** A provider that answers every prompt with a fixed completion. */
const replying = (text: string): AiProvider => ({ name: "gemini", complete: async () => ({ text, model: "stub" }) });

function appWith(provider: AiProvider) {
  return createApp(
    loadEnv({ NODE_ENV: "test", RATE_LIMIT_DISABLED: "true", SUPABASE_JWT_SECRET: SECRET, CORS_ORIGINS: "x" }),
    { services: { ai: new AiService(provider, new MemoryCache(), createLogger("error")) } },
  );
}

async function post(app: ReturnType<typeof createApp>, query: string) {
  const token = await new SignJWT({ sub: "u1" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(SECRET));
  return app.request("/api/ai/scout/parse", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

describe("POST /api/ai/scout/parse", () => {
  it("accepts fenced JSON and returns validated filters", async () => {
    const app = appWith(
      replying('```json\n{"positions":["DF"],"maxAge":23,"maxPriceM":null,"foot":null,"traits":["physical"]}\n```'),
    );
    const res = await post(app, "tall centre back under 23 good in the air");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiSuccess<{ filters: ScoutFilters; provider: string }>;
    expect(body.data.filters).toEqual({ positions: ["DF"], maxAge: 23, traits: ["physical"] });
    expect(body.data.provider).toBe("gemini");
  });

  it("rejects model output outside the schema instead of trusting it", async () => {
    const app = appWith(replying('{"positions":["STRIKER"],"traits":["magic"]}'));
    const res = await post(app, "a magic striker");
    expect(res.status).toBe(502);
    expect(((await res.json()) as ApiFailure).error.code).toBe("upstream_error");
  });
});
