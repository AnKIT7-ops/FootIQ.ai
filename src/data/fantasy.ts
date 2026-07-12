import type { FantasyPick } from "./types";

export const gameweek = {
  number: 32,
  deadline: "Sat 11:00",
  averageScore: 52,
  yourScore: 68,
  overallRank: "124,502",
  rankMove: 18400,
};

export const captainPicks: FantasyPick[] = [
  { playerId: "haaland", expectedPoints: 8.4, ownership: 74, fixtureEase: 4, note: "Chelsea concede the most big chances away in the top six. Penalty duty secured." },
  { playerId: "saka", expectedPoints: 7.2, ownership: 41, fixtureEase: 3, note: "In career-best form and on set pieces; Chelsea's left side is the softer flank." },
  { playerId: "wirtz", expectedPoints: 6.9, ownership: 28, fixtureEase: 3, note: "Highest xA in the league; City's box midfield leaves the ten pocket open." },
];

export const differentials: FantasyPick[] = [
  { playerId: "kudus", expectedPoints: 5.8, ownership: 8, fixtureEase: 3, note: "5.1 fouls drawn/90 at home; United's back three collects cards. Bonus-point magnet." },
  { playerId: "gordon", expectedPoints: 5.4, ownership: 11, fixtureEase: 4, note: "Villa's high trap vs the league's fastest presser. In-behind chances guaranteed." },
  { playerId: "olise", expectedPoints: 6.1, ownership: 6, fixtureEase: 5, note: "Bundesliga assets are under-owned globally. Bayern at home average 3.1 goals." },
];

export const transferTips = {
  in: [
    { playerId: "wirtz", reason: "Liverpool's next five fixtures rate 2nd-easiest by FootIQ difficulty. Attacking returns in 7 of last 9." },
    { playerId: "gordon", reason: "Fixture swing: NEW face 4 bottom-half sides in 5. Ownership still under 12%." },
  ],
  out: [
    { playerId: "vinicius", reason: "Blank gameweek risk with Copa final rescheduling; rotation risk behind Mbappé's fitness." },
    { playerId: "bruno", reason: "United's next three rate hardest in the league; his xGI has halved across the last six." },
  ],
};

export const injuryAlerts = [
  { playerId: "rodri", status: "75% — managed minutes", note: "One start per week protocol through April. Avoid captaincy; hold if bench cover exists." },
  { playerId: "musiala", status: "Fit — minutes capped", note: "60-minute spells until May. Explosive per-minute output but ceiling-limited." },
  { playerId: "isak", status: "85% — hamstring watch", note: "Trained fully Thursday. Slot rates him 'ready'; late team-news pivot recommended." },
];

/** FootIQ fixture difficulty next 5, 1 (easy) - 5 (hard), for fantasy planner. */
export const fixtureDifficulty: Record<string, number[]> = {
  ars: [4, 2, 3, 1, 2],
  mci: [3, 4, 2, 2, 1],
  liv: [4, 3, 1, 2, 2],
  che: [4, 3, 2, 4, 1],
  mun: [3, 2, 4, 3, 2],
  tot: [2, 3, 3, 2, 4],
  new: [2, 1, 2, 3, 3],
  avl: [3, 2, 1, 4, 2],
};
