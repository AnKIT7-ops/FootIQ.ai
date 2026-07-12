/**
 * Demo dataset bridge — the ONE place the server touches the frontend's
 * bundled demo data. Everything else goes through repositories, so swapping
 * in a real football data provider later means changing the repository, not
 * the routes.
 *
 * Relative import into ../src/data is intentional (shared source of truth,
 * no duplication); the data layer is kept alias-free so it resolves under
 * tsx, vitest, and wrangler without bundler config.
 */

export { players, playerById, getPlayer, playersOf, attributeLabels } from "../../../src/data/players";
export { teams, teamById, getTeam, leagueTable } from "../../../src/data/teams";
export {
  matches,
  matchById,
  liveMatches,
  upcomingMatches,
  finishedMatches,
  matchDetail,
  teamMatches,
} from "../../../src/data/matches";
export { news, newsById, breakingNews } from "../../../src/data/news";
export { transferRumors, rumorById, trendingTransfers } from "../../../src/data/transfers";
export { predictions, predictionByMatch } from "../../../src/data/predictions";
export { clips, clipById, clipCategories } from "../../../src/data/clips";
export { historicalMoments, searchHistory } from "../../../src/data/history";
export {
  gameweek,
  captainPicks,
  differentials,
  transferTips,
  injuryAlerts,
  fixtureDifficulty,
} from "../../../src/data/fantasy";

export type * from "../../../src/data/types";
