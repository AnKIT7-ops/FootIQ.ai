import type { AiCompletion, AiProvider, AiRequest } from "../types";

/**
 * Deterministic mock — the default provider when no API key is configured,
 * and the provider used in tests. Produces a plausible, clearly-labeled
 * analysis so demo deployments stay fully interactive at zero cost.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  /** Test hook: inspect what was requested. */
  calls: AiRequest[] = [];

  async complete(request: AiRequest): Promise<AiCompletion> {
    this.calls.push(request);
    const subject = extractSubject(request.prompt);
    return {
      text: [
        `**Analysis${subject ? ` — ${subject}` : ""}** *(demo engine)*`,
        "",
        "- Profile fits the requested brief; underlying numbers trend positively across the sample.",
        "- Output quality, availability and market conditions all sit inside expected ranges.",
        "- Key risk: small sample size — treat this as directional, not definitive.",
        "",
        "Verdict: worth deeper live analysis once real AI providers are configured (set `AI_PROVIDER` and an API key).",
      ].join("\n"),
      model: "footiq-demo-1",
      usage: { inputTokens: Math.ceil(request.prompt.length / 4), outputTokens: 90 },
    };
  }
}

function extractSubject(prompt: string): string | null {
  const m = prompt.match(/"name":\s*"([^"]+)"/);
  return m ? m[1] : null;
}
