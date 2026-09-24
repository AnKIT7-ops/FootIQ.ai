import { describe, expect, it } from "vitest";
import { getTeam, teams } from "./teams";

describe("getTeam", () => {
  it("returns the held team for a known id", () => {
    expect(getTeam(teams[0].id)).toBe(teams[0]);
  });

  it("never lends another club's identity to an unknown id", () => {
    const home = getTeam("not-synced-yet-a");
    const away = getTeam("not-synced-yet-b");
    expect(home.id).toBe("not-synced-yet-a");
    expect(away.id).toBe("not-synced-yet-b");
    expect(home.name).not.toBe(teams[0].name);
  });
});
