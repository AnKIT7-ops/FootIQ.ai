import type { Team } from "@/data/types";

/** "München" matches "munchen": fold case and accents before comparing. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Teams whose name, short name or TLA contains the query; prefix hits first. */
export function searchTeams(teams: Team[], query: string, limit = 8): Team[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { team: Team; rank: number }[] = [];
  for (const team of teams) {
    const fields = [team.name, team.short, team.tla].map(fold);
    if (fields.some((f) => f.startsWith(q))) scored.push({ team, rank: 0 });
    else if (fields.some((f) => f.includes(q))) scored.push({ team, rank: 1 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.team.name.localeCompare(b.team.name))
    .slice(0, limit)
    .map((s) => s.team);
}
