import { describe, expect, it } from "vitest";
import { clampToPitch, nudge } from "./pitch";

describe("nudge", () => {
  it("moves 2% per press, 10% with Shift", () => {
    expect(nudge({ x: 50, y: 50 }, "ArrowRight", false)).toEqual({ x: 52, y: 50 });
    expect(nudge({ x: 50, y: 50 }, "ArrowLeft", true)).toEqual({ x: 40, y: 50 });
    expect(nudge({ x: 50, y: 50 }, "ArrowUp", false)).toEqual({ x: 50, y: 48 });
    expect(nudge({ x: 50, y: 50 }, "ArrowDown", true)).toEqual({ x: 50, y: 60 });
  });

  it("clamps to the pitch like the pointer drag", () => {
    expect(nudge({ x: 97, y: 50 }, "ArrowRight", true)).toEqual({ x: 98, y: 50 });
    expect(nudge({ x: 3, y: 50 }, "ArrowLeft", false)).toEqual({ x: 2, y: 50 });
    expect(nudge({ x: 50, y: 6 }, "ArrowUp", true)).toEqual({ x: 50, y: 4 });
    expect(nudge({ x: 50, y: 95 }, "ArrowDown", false)).toEqual({ x: 50, y: 96 });
    expect(clampToPitch(-20, 140)).toEqual({ x: 2, y: 96 });
  });

  it("ignores keys it doesn't handle", () => {
    expect(nudge({ x: 50, y: 50 }, "Tab", false)).toBeNull();
    expect(nudge({ x: 50, y: 50 }, "Enter", true)).toBeNull();
  });
});
