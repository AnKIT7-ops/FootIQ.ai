import { describe, expect, it } from "vitest";
import { shouldLoadSupabase } from "./supabase";

describe("shouldLoadSupabase", () => {
  it("skips the SDK for an anonymous visitor", () => {
    expect(shouldLoadSupabase(["footiq-onboarded", "footiq-theme"], "", "")).toBe(false);
    expect(shouldLoadSupabase([], "#main", "?team=arsenal&next=/profile")).toBe(false);
  });

  it("loads it for a persisted session", () => {
    expect(shouldLoadSupabase(["sb-abcdefgh-auth-token"], "", "")).toBe(true);
  });

  it("loads it for OAuth / magic-link redirects", () => {
    expect(shouldLoadSupabase([], "#access_token=x&refresh_token=y&type=magiclink", "")).toBe(true);
    expect(shouldLoadSupabase([], "#error=access_denied&error_description=nope", "")).toBe(true);
    expect(shouldLoadSupabase([], "", "?code=abc")).toBe(true);
    expect(shouldLoadSupabase([], "", "?token_hash=abc&type=magiclink")).toBe(true);
  });
});
