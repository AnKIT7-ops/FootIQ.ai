import { describe, expect, it } from "vitest";
import onboardingSrc from "../components/shell/Onboarding.tsx?raw";
import { fromAiFilters, hasCriteria, parseScoutQuery } from "./scout-query";

describe("parseScoutQuery → decision", () => {
  it.each(["asdkjh qwe zzz", "⚽🔥🧤", "<script>alert(1)</script>", "   ", ""])("finds nothing to search on in %j", (q) => {
    const p = parseScoutQuery(q);
    expect(hasCriteria(p)).toBe(false);
    expect(p.chips).toEqual([]);
  });

  it("lists what it understood and what it ignored", () => {
    const p = parseScoutQuery("left-footed winger under €30M who presses hard");
    expect(p.positions).toEqual(["FW"]);
    expect(p.traits).toEqual(["ball_winning"]);
    expect(p.maxPrice).toBeUndefined();
    expect(p.chips).toEqual(["forward", "excels: ball-winning"]);
    expect(p.ignored).toEqual(["left-footed", "under €30M", "wide vs central role"]);
  });

  it("never labels a forward as wide; wing-backs are defenders", () => {
    expect(parseScoutQuery("fast winger").chips).toEqual(["forward"]);
    expect(parseScoutQuery("fast winger").ignored).toEqual(["fast", "wide vs central role"]);
    expect(parseScoutQuery("attacking wing-back").positions).toEqual(["DF"]);
  });

  it("applies an FPL price, not a transfer fee", () => {
    const p = parseScoutQuery("cheap defender under £5m");
    expect(p.maxPrice).toBe(5);
    expect(p.chips).toEqual(["FPL price < £5m", "defender"]);
    expect(p.ignored).toEqual([]);
    expect(parseScoutQuery("striker under £40m").ignored).toEqual(["under £40m"]);
  });

  it("only-ignored terms still count as nothing to search on", () => {
    const p = parseScoutQuery("left footed and fast");
    expect(hasCriteria(p)).toBe(false);
    expect(p.ignored).toEqual(["left footed", "fast"]);
  });

  it("keeps price and ignored terms when the AI does the reading", () => {
    const kw = parseScoutQuery("left-footed defender under £5m");
    const p = fromAiFilters({ positions: ["DF"], traits: [] }, kw);
    expect(p.maxPrice).toBe(5);
    expect(p.ignored).toEqual(["left-footed"]);
  });

  it("the onboarding tour's example is fully supported", () => {
    const example = onboardingSrc.match(/eyebrow: "AI Scout"[\s\S]*?“([^”]+)”/)?.[1];
    expect(example).toBeTruthy();
    const p = parseScoutQuery(example!);
    expect(hasCriteria(p)).toBe(true);
    expect(p.ignored).toEqual([]);
    expect(p.chips).toEqual(["age < 25", "midfielder", "excels: ball-winning"]);
  });
});
