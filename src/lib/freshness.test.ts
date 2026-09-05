import { describe, expect, it } from "vitest";
import { daysUntil, relativeTime } from "./freshness";

/**
 * Local-time constructors throughout, never UTC literals.
 *
 * `daysUntil` counts LOCAL calendar days, matching how kickoffLabel buckets
 * fixtures for the reader. A test written with "…T23:00:00Z" literals passes in
 * London and fails in GMT+5:30, where that instant is already tomorrow — the
 * assertion would be testing the runner's timezone, not the function.
 */
const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm);
const NOW = at(2026, 7, 17, 12, 0);
const isoAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("relativeTime", () => {
  it("reports the age of a sync, coarsely", () => {
    expect(relativeTime(isoAgo(30), NOW)).toBe("just now");
    expect(relativeTime(isoAgo(10 * 60), NOW)).toBe("10m ago");
    expect(relativeTime(isoAgo(3 * 3600), NOW)).toBe("3h ago");
    expect(relativeTime(isoAgo(2 * 86400), NOW)).toBe("2d ago");
  });

  it("treats anything under 90s as just now, and 90s+ as minutes", () => {
    expect(relativeTime(isoAgo(89), NOW)).toBe("just now");
    expect(relativeTime(isoAgo(90), NOW)).toBe("2m ago");
  });

  it("never renders a future age", () => {
    // Client and server clocks disagree constantly. "in -3 minutes" is worse
    // than a white lie here.
    expect(relativeTime(isoAgo(-180), NOW)).toBe("just now");
  });

  it("returns null when nothing has been synced", () => {
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime("not-a-date", NOW)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("counts whole days to a season start", () => {
    expect(daysUntil(at(2026, 8, 16, 15, 0).toISOString(), NOW)).toBe(30);
    expect(daysUntil(at(2026, 7, 18, 9, 0).toISOString(), NOW)).toBe(1);
  });

  it("counts by calendar day, not by elapsed hours", () => {
    // 23:00 tonight is still today (0 days). Dividing elapsed hours by 24 would
    // round 11 hours up to 1 and claim the season starts tomorrow when it
    // starts this evening.
    expect(daysUntil(at(2026, 7, 17, 23, 0).toISOString(), NOW)).toBe(0);
    expect(daysUntil(at(2026, 7, 18, 1, 0).toISOString(), NOW)).toBe(1);
  });

  it("floors at zero for dates in the past", () => {
    expect(daysUntil(at(2026, 7, 1, 12, 0).toISOString(), NOW)).toBe(0);
  });
});
