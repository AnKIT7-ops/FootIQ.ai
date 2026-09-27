import { players } from "@/lib/repositories/players";
import { teams, getTeam } from "@/lib/repositories/teams";
import { predictions } from "@/lib/repositories/predictions";
import { matchById } from "@/lib/repositories/matches";
import { playerPathFor } from "@/lib/slug-builders";

/**
 * Scripted concierge: answers from local data, clearly marked as the amber IQ layer.
 * Loaded on demand (dynamic import) so the data bundle stays out of the shell chunk.
 */
export function answer(raw: string): string {
  const q = raw.toLowerCase();

  const player = players.find((p) => q.includes(p.name.toLowerCase()));
  if (player) {
    const s = player.stats;
    const fitness = player.news ? ` Availability: ${player.news}.` : "";
    return `${player.name} (${player.role}, ${getTeam(player.teamId).short}) this Premier League season: ${s.goals} goals, ${s.assists} assists, ${s.xG.toFixed(1)} xG and ${s.xA.toFixed(1)} xA in ${s.minutes} minutes.${fitness} Full profile → ${playerPathFor(player)}`;
  }

  if (q.includes("captain") || q.includes("fantasy")) {
    const top = [...players].filter((p) => p.availability === "available").sort((a, b) => b.fantasy.expectedPoints - a.fantasy.expectedPoints)[0];
    if (top) {
      return `FPL's own projection has ${top.name} top for next gameweek at ${top.fantasy.expectedPoints.toFixed(1)} points (${top.fantasy.selectedBy}% owned). That's the Premier League's model, not a promise. More in the Fantasy Assistant → /fantasy`;
    }
    return "Fantasy data hasn't loaded yet — open the Fantasy Assistant → /fantasy";
  }

  if (q.includes("predict") || q.includes(" vs ") || q.includes("who wins")) {
    for (const pred of predictions) {
      const m = matchById.get(pred.matchId);
      if (!m) continue;
      const h = getTeam(m.homeId);
      const a = getTeam(m.awayId);
      if (q.includes(h.short.toLowerCase()) || q.includes(a.short.toLowerCase()) || q.includes(h.name.toLowerCase()) || q.includes(a.name.toLowerCase())) {
        return `${h.short} vs ${a.short}: model says ${pred.homeWin}% home / ${pred.draw}% draw / ${pred.awayWin}% away, expected ${pred.expectedHome.toFixed(1)}–${pred.expectedAway.toFixed(1)}. Key factor: ${pred.reasoning[0]} These are probabilities, not promises — full breakdown → /predictions`;
      }
    }
    return "I model every upcoming league fixture with outcome probabilities and score distributions — open Predictions → /predictions";
  }

  const team = teams.find((t) => q.includes(t.short.toLowerCase()) || q.includes(t.name.toLowerCase()));
  if (team) {
    return `${team.name}: ${ordinal(team.position)} in the ${team.league} on ${team.points} pts (form ${team.form}). Style: ${team.styleTags.join(", ").toLowerCase()}. Tactical read: ${team.aiReport[0]} Team page → /team/${team.id}`;
  }

  if (q.includes("transfer") || q.includes("rumor") || q.includes("rumour")) {
    return "FootIQ doesn't track rumours — there's no verified feed for them. Real transfer headlines from BBC Sport, the Guardian and Sky Sports are in News → /news";
  }
  if (q.includes("scout") || q.includes("find")) {
    return "Describe the player you need in plain language — e.g. 'young midfielder who creates chances' — and AI Scout ranks Premier League players on their real per-90 output. → /scout";
  }
  if (q.includes("hello") || q.includes("hi") || q.length < 8) {
    return "I'm the FootIQ concierge — ask me about any Premier League player, team, prediction or fantasy call. My answers are generated from FootIQ's data (that's why I wear amber).";
  }
  return "I can answer from FootIQ data: try a player ('Bukayo Saka'), a team ('Arsenal form'), a scouting brief ('find a young playmaker') or fantasy ('who to captain?').";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
