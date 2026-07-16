/**
 * AI provenance — the sibling of `freshness.ts`. Where that answers "is this
 * data live or demo?", this answers "did a real model produce this?".
 *
 * `undefined` means the text was generated client-side (content.ts templates,
 * the scripted concierge) and never touched a provider at all. `"mock"` means
 * the server answered with MockAiProvider because no API key is configured.
 * Both are the demo engine as far as a reader is concerned.
 */

const REAL_PROVIDERS = new Set(["claude", "openai", "gemini", "ollama"]);

/** True when no real model produced the output. Fails closed on unknowns. */
export function isDemoEngine(provider?: string): boolean {
  return !REAL_PROVIDERS.has((provider ?? "").trim());
}
