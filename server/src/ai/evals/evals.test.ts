import { describe, expect, it } from "vitest";
import golden from "./golden.json";
import { prompts, promptVariants, type RenderedPrompt } from "../prompts";
import * as demo from "../../data/demo";
import { AiService, createAiProvider } from "../service";
import { MemoryCache } from "../../cache/memory";
import { createLogger } from "../../lib/logger";
import { loadEnv } from "../../config/env";

/**
 * Prompt/eval harness — the MLOps offline gate.
 *
 * Offline (always): every golden case renders its prompt and asserts the
 * grounding data and structural instructions are actually present — the
 * class of regression that silently ruins output quality when someone edits
 * the registry.
 *
 * Live (EVAL_LIVE=1 with a configured provider): the same cases run against
 * the real provider and completions are scored against `expect`. Kept out of
 * CI by default (cost + nondeterminism); run before shipping prompt changes.
 */

interface GoldenCase {
  task: string;
  input: Record<string, unknown>;
  promptMustInclude: string[];
  expect: { minWords: number; mustMention: string[]; mustNotMention: string[] };
}

function render(c: GoldenCase): RenderedPrompt {
  switch (c.task) {
    case "scout_report": {
      const p = demo.playerById.get(c.input.playerId as string)!;
      return prompts.scout_report(p, demo.teamById.get(p.teamId) ?? null);
    }
    case "scout_report_variant_b": {
      const p = demo.playerById.get(c.input.playerId as string)!;
      return promptVariants.scout_report(p, demo.teamById.get(p.teamId) ?? null);
    }
    case "news_summary":
      return prompts.news_summary(demo.newsById.get(c.input.articleId as string)!);
    case "prediction_explanation": {
      const pred = demo.predictionByMatch.get(c.input.matchId as string)!;
      const m = demo.matchById.get(pred.matchId)!;
      return prompts.prediction_explanation(pred, demo.teamById.get(m.homeId) ?? null, demo.teamById.get(m.awayId) ?? null);
    }
    case "player_comparison":
      return prompts.player_comparison((c.input.playerIds as string[]).map((id) => demo.playerById.get(id)!));
    default:
      throw new Error(`No renderer for golden task: ${c.task}`);
  }
}

const cases = golden.cases as GoldenCase[];

describe("prompt evals (offline)", () => {
  it.each(cases.map((c) => [c.task + ":" + JSON.stringify(c.input), c] as const))("%s renders grounded prompt", (_label, c) => {
    const rendered = render(c);
    for (const needle of c.promptMustInclude) {
      expect(rendered.prompt, `prompt for ${c.task} must include "${needle}"`).toContain(needle);
    }
    // injection containment: grounding lives in the user prompt, never the system prompt
    expect(rendered.system).not.toContain("{");
    expect(rendered.version).toBeGreaterThan(0);
    expect(rendered.cacheSeed.length).toBeGreaterThan(0);
  });

  it("variant B has a distinct version from variant A (cache isolation)", () => {
    const p = demo.playerById.get("saka")!;
    const a = prompts.scout_report(p, null);
    const b = promptVariants.scout_report(p, null);
    expect(b.version).not.toBe(a.version);
    expect(b.task).toBe(a.task);
  });
});

const live = process.env.EVAL_LIVE === "1";

describe.runIf(live)("prompt evals (live provider)", () => {
  const env = loadEnv(process.env);
  const logger = createLogger("error");
  const ai = new AiService(createAiProvider(env, logger), new MemoryCache(), logger);

  it.each(cases.map((c) => [c.task, c] as const))(
    "%s completion meets expectations",
    async (_label, c) => {
      const result = await ai.run(render(c), { bypassCache: true });
      const words = result.text.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(c.expect.minWords);
      for (const s of c.expect.mustMention) expect(result.text).toContain(s);
      for (const s of c.expect.mustNotMention) expect(result.text.toLowerCase()).not.toContain(s.toLowerCase());
    },
    60_000,
  );
});
