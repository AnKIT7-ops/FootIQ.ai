import { players, getPlayer } from "@/lib/repositories/players";
import { teams, getTeam } from "@/lib/repositories/teams";
import { predictions } from "@/lib/repositories/predictions";
import { matchById } from "@/lib/repositories/matches";
import { captainPicks } from "@/lib/repositories/fantasy";
import { money } from "@/lib/utils";

/**
 * Scripted concierge: answers from local data, clearly marked as the amber IQ layer.
 * Loaded on demand (dynamic import) so the data bundle stays out of the shell chunk.
 */
export function answer(raw: string): string {
  const q = raw.toLowerCase();

  const player = players.find((p) => q.includes(p.name.toLowerCase()) || q.includes(p.id));
  if (player) {
    const s = player.stats;
    return `${player.name} (${player.role}, ${getTeam(player.teamId).short}) is rated ${s.rating.toFixed(2)} this season: ${s.goals} goals, ${s.assists} assists, ${s.xG.toFixed(1)} xG in ${s.apps} apps. Market value ${money(player.marketValue)}. Strengths: ${player.strengths[0].toLowerCase()}; watch-out: ${player.weaknesses[0].toLowerCase()}. Full profile → /player/${player.id}`;
  }

  if (q.includes("captain") || q.includes("fantasy")) {
    const top = captainPicks[0];
    const p = getPlayer(top.playerId);
    return `Captaincy model says ${p.name} — ${top.expectedPoints.toFixed(1)} expected points (${top.ownership}% owned). ${top.note} More in the Fantasy Assistant → /fantasy`;
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
    return "I model every upcoming fixture with outcome probabilities, score distributions and MVP candidates — open Predictions (→ /predictions) or name a fixture like 'predict City vs Chelsea'.";
  }

  const team = teams.find((t) => q.includes(t.short.toLowerCase()) || q.includes(t.name.toLowerCase()));
  if (team) {
    return `${team.name}: ${ordinal(team.position)} in the ${team.league} on ${team.points} pts (form ${team.form}). Style: ${team.styleTags.join(", ").toLowerCase()}. Tactical read: ${team.aiReport[0]} Team page → /team/${team.id}`;
  }

  if (q.includes("transfer") || q.includes("rumor") || q.includes("rumour")) {
    return "The Transfer Center tracks every rumor with a completion probability, source-reliability score, financial breakdown and fan sentiment. Hottest right now: Watkins → Newcastle at 41%. → /transfers";
  }
  if (q.includes("scout") || q.includes("find")) {
    return "Describe the player you need in plain language — e.g. 'left-footed winger under €30M who presses hard' — and AI Scout will rank matches with fit scores. → /scout";
  }
  if (q.includes("hello") || q.includes("hi") || q.length < 8) {
    return "I'm the FootIQ concierge — ask me about any player, team, prediction, transfer or fantasy call. Everything I say is model inference (that's why I wear amber).";
  }
  return "I can answer from live FootIQ data: try a player ('how good is Wirtz?'), a team ('Arsenal form'), a fixture ('predict Madrid vs PSG'), fantasy ('who to captain?') or transfers.";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
