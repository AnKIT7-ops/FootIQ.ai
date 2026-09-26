import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "../app";
import { loadEnv } from "../config/env";
import { AiService } from "../ai/service";
import { MemoryCache } from "../cache/memory";
import { createLogger } from "../lib/logger";
import type { AiProvider, AiRequest } from "../ai/types";
import { prompts } from "../ai/prompts";
import type { Player } from "../data/demo";
import type { AiResult, ApiSuccess } from "../../../shared/contracts";

const SECRET = "test-jwt-secret-value-at-least-20-chars";

/** Answers every prompt with a fixed completion and remembers what it was sent. */
function recording() {
  const seen: AiRequest[] = [];
  const provider: AiProvider = {
    name: "gemini",
    complete: async (req) => {
      seen.push(req);
      return { text: "Arsenal sit top on the table FootIQ holds.", model: "stub" };
    },
  };
  return { provider, seen };
}

function appWith(provider: AiProvider) {
  return createApp(
    loadEnv({ NODE_ENV: "test", RATE_LIMIT_DISABLED: "true", SUPABASE_JWT_SECRET: SECRET, CORS_ORIGINS: "x" }),
    { services: { ai: new AiService(provider, new MemoryCache(), createLogger("error")) } },
  );
}

async function ask(app: ReturnType<typeof createApp>, question: string, signedIn = true) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signedIn) {
    const token = await new SignJWT({ sub: "u1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(SECRET));
    headers.Authorization = `Bearer ${token}`;
  }
  return app.request("/api/ai/ask", { method: "POST", headers, body: JSON.stringify({ question }) });
}

describe("POST /api/ai/ask", () => {
  it("answers a signed-in question with the real provider's text", async () => {
    const { provider, seen } = recording();
    const res = await ask(appWith(provider), "Who is top of the league?");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiSuccess<AiResult>;
    expect(body.data.provider).toBe("gemini");
    expect(body.data.text).toContain("Arsenal");
    // The question rides in the user turn with the held data, never in the system prompt.
    expect(seen[0].prompt).toContain("FAN'S QUESTION: Who is top of the league?");
    expect(seen[0].prompt).toContain('"tables"');
    expect(seen[0].system).not.toContain("top of the league");
  });

  it("hands the model only the players the question names, by whole word", () => {
    const player = (name: string) =>
      ({ id: name, name, teamId: "ars", role: "Midfielder", availability: "available", news: "", stats: {}, fantasy: { expectedPoints: 0, selectedBy: 0 } }) as unknown as Player;
    const squad = [player("Martin Ødegaard"), player("Mikel Arteta"), player("Bukayo Saka")];
    const named = (question: string) =>
      JSON.parse(prompts.concierge_answer({ question, teams: [], upcoming: [], players: squad }).prompt.match(/^\{.*\}$/m)![0]).playersNamedInQuestion.map(
        (p: { name: string }) => p.name,
      );
    expect(named("How is Ødegaard doing?")).toEqual(["Martin Ødegaard"]);
    expect(named("is the art of pressing dead")).toEqual([]);
    expect(named("bukayo saka form")).toEqual(["Bukayo Saka"]);
  });

  it("requires sign-in, like every metered AI route", async () => {
    const { provider, seen } = recording();
    const res = await ask(appWith(provider), "Who is top of the league?", false);
    expect(res.status).toBe(401);
    expect(seen).toHaveLength(0);
  });
});
