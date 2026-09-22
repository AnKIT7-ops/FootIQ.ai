import { forecastFixture as shared, type FixtureForecast as Shared, type Forecast } from "@shared/forecast";
import type { Match, Team } from "@/data/types";

export type { Forecast };
export type FixtureForecast = Shared<Team>;

/** See shared/forecast.ts — one rulebook for the web app and the API. */
export const forecastFixture = (match: Match, teams: Team[]): FixtureForecast => shared(match, teams);
