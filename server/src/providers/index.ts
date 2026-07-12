import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import type { FootballDataProvider } from "./types";
import { FootballDataOrgProvider } from "./football-data";
import { ApiFootballProvider } from "./api-football";
import { DemoProvider } from "./demo";

export type { FootballDataProvider, NormalizedMatch, NormalizedTeamStanding } from "./types";
export { ProviderError } from "./types";
export { DemoProvider, MockProvider } from "./demo";
export { FootballDataOrgProvider } from "./football-data";
export { ApiFootballProvider } from "./api-football";

/**
 * Provider factory — DATA_PROVIDER selects the source; a selected-but-
 * unconfigured provider (missing key) degrades to demo with a warning
 * instead of failing the boot. Season start year derives from the calendar
 * (European season rolls over in July).
 */
export function createDataProvider(env: Env, logger: Logger): FootballDataProvider {
  const season = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;

  const selected: FootballDataProvider = (() => {
    switch (env.DATA_PROVIDER) {
      case "football-data":
        return new FootballDataOrgProvider(env.FOOTBALL_DATA_API_KEY, env.FOOTBALL_DATA_COMPETITION);
      case "api-football":
        return new ApiFootballProvider(env.API_FOOTBALL_KEY, env.API_FOOTBALL_LEAGUE, season);
      default:
        return new DemoProvider();
    }
  })();

  if (!selected.available()) {
    logger.warn("data_provider.unconfigured", { selected: selected.name, fallback: "demo" });
    return new DemoProvider();
  }
  return selected;
}
