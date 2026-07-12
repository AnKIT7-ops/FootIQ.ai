import type { Clip } from "./types";

export const clips: Clip[] = [
  { id: "c1", title: "Saka's top-corner curler vs Liverpool", type: "goal", playerId: "saka", teamId: "ars", seconds: 24, views: "2.4M", likes: "312K", caption: "The move Arsenal drilled all season, executed in the biggest game of it." },
  { id: "c2", title: "Yamal's no-look assist in El Clásico", type: "assist", playerId: "yamal", teamId: "bar", seconds: 18, views: "5.1M", likes: "718K", caption: "Eighteen years old. Looked left, passed right, broke the Bernabéu's brain." },
  { id: "c3", title: "Raya's triple save sequence", type: "save", playerId: "raya", teamId: "ars", seconds: 31, views: "1.2M", likes: "156K", caption: "Three shots, four seconds, zero goals. Golden Glove football." },
  { id: "c4", title: "Kudus dances through five", type: "skill", playerId: "kudus", teamId: "tot", seconds: 22, views: "3.8M", likes: "540K", caption: "Started on the touchline, ended in the box. Nobody touched him." },
  { id: "c5", title: "Van Dijk's last-ditch masterclass", type: "tackle", playerId: "vvd", teamId: "liv", seconds: 15, views: "890K", likes: "97K", caption: "34 years old, still reads the game two moves early." },
  { id: "c6", title: "Haaland's backheel volley", type: "goal", playerId: "haaland", teamId: "mci", seconds: 19, views: "6.7M", likes: "1.1M", caption: "Physics reviewed the goal and approved it reluctantly." },
  { id: "c7", title: "Musiala's return: the slalom goal", type: "goal", playerId: "musiala", teamId: "bay", seconds: 27, views: "4.2M", likes: "689K", caption: "Eight months out, three touches, five defenders beaten." },
  { id: "c8", title: "Dembélé's two-footed double feint", type: "skill", playerId: "dembele", teamId: "psg", seconds: 16, views: "2.9M", likes: "402K", caption: "The defender guessed left. And right. Both were wrong." },
  { id: "c9", title: "Wirtz threads the impossible pass", type: "assist", playerId: "wirtz", teamId: "liv", seconds: 21, views: "1.8M", likes: "245K", caption: "Four Liverpool players called for it. He picked the fifth option nobody saw." },
  { id: "c10", title: "Mbappé 0-to-100 vs the high line", type: "goal", playerId: "mbappe", teamId: "rma", seconds: 20, views: "7.3M", likes: "1.3M", caption: "From the halfway line to the net in 6.2 seconds." },
  { id: "c11", title: "Caicedo wins it three times in one minute", type: "tackle", playerId: "caicedo", teamId: "che", seconds: 34, views: "760K", likes: "88K", caption: "Lost the ball once. Took it back three times. Personal vendetta football." },
  { id: "c12", title: "The Emirates limbs for Rice's winner", type: "moment", playerId: "rice", teamId: "ars", seconds: 29, views: "1.5M", likes: "203K", caption: "No commentary needed. Just 60,000 people losing it in 4K." },
];

export const clipById = new Map(clips.map((c) => [c.id, c]));

export const clipCategories = ["all", "goal", "assist", "save", "skill", "tackle", "moment"] as const;
