import * as demo from "../data/demo";
import type { NewsArticle, Player, Team } from "../data/demo";
import { ApiError } from "../lib/errors";

/**
 * Recommendation engine — content-based scoring over the catalog. No ML
 * infra: with tens of entities, transparent feature similarity IS the right
 * model, and every recommendation can explain itself (the product rule).
 * When embeddings earn their keep (thousands of entities), each method body
 * swaps independently — signatures are the contract.
 */
export class RecommendService {
  /** Articles sharing tags/teams/players with the given one, best overlap first. */
  relatedArticles(articleId: string, limit = 4): Array<{ article: NewsArticle; reason: string }> {
    const base = demo.newsById.get(articleId);
    if (!base) throw ApiError.notFound("Article");
    return demo.news
      .filter((n) => n.id !== base.id)
      .map((n) => {
        const sharedTags = n.tags.filter((t) => base.tags.includes(t));
        const sharedTeams = n.teamIds.filter((t) => base.teamIds.includes(t));
        const sharedPlayers = n.playerIds.filter((p) => base.playerIds.includes(p));
        const score = sharedTags.length + sharedTeams.length * 2 + sharedPlayers.length * 3 + (n.category === base.category ? 1 : 0);
        const reason =
          sharedPlayers.length > 0
            ? `also about ${demo.playerById.get(sharedPlayers[0])?.name ?? "the same player"}`
            : sharedTeams.length > 0
              ? `also covers ${demo.teamById.get(sharedTeams[0])?.name ?? "the same club"}`
              : sharedTags.length > 0
                ? `shares the "${sharedTags[0]}" thread`
                : `more ${base.category.toLowerCase()}`;
        return { article: n, reason, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _s, ...r }) => r);
  }

  /** Comparison pairs worth opening for a player: same position, closest profile. */
  suggestedComparisons(playerId: string, limit = 3): Array<{ player: Player; reason: string }> {
    const base = demo.playerById.get(playerId);
    if (!base) throw ApiError.notFound("Player");
    const dist = (a: Player, b: Player) => {
      const keys = Object.keys(a.attributes) as Array<keyof Player["attributes"]>;
      return keys.reduce((s, k) => s + Math.abs(a.attributes[k] - b.attributes[k]), 0) / keys.length;
    };
    return demo.players
      .filter((p) => p.id !== base.id && p.position === base.position)
      .map((p) => ({ p, d: dist(base, p), valueGap: Math.abs(p.marketValue - base.marketValue) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, limit)
      .map(({ p, d }) => ({
        player: p,
        reason: d < 8 ? `near-identical attribute profile (Δ${d.toFixed(1)})` : `closest ${base.position} profile in the dataset`,
      }));
  }

  /** Teams a user would plausibly follow next, from style similarity to their favorites. */
  recommendedTeams(favoriteTeamIds: string[], limit = 3): Array<{ team: Team; reason: string }> {
    const favs = favoriteTeamIds.map((id) => demo.teamById.get(id)).filter((t): t is Team => Boolean(t));
    if (favs.length === 0) {
      // cold start: the form leaders
      return demo.leagueTable.slice(0, limit).map((team) => ({ team, reason: "top of the table right now" }));
    }
    const styleDist = (a: Team, b: Team) =>
      Math.abs(a.style.tempo - b.style.tempo) +
      Math.abs(a.style.pressIntensity - b.style.pressIntensity) +
      Math.abs(a.style.directness - b.style.directness);
    const favIds = new Set(favoriteTeamIds);
    return demo.teams
      .filter((t) => !favIds.has(t.id))
      .map((t) => {
        const nearest = favs.reduce((best, f) => Math.min(best, styleDist(t, f)), Infinity);
        const like = favs.find((f) => styleDist(t, f) === nearest);
        return { team: t, score: nearest, reason: `plays ${like ? `like ${like.name}` : "a similar style"} (${t.styleTags[0]?.toLowerCase() ?? "style match"})` };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map(({ score: _s, ...r }) => r);
  }
}
