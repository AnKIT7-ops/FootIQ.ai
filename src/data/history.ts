import type { HistoricalMoment } from "./types";

export const historicalMoments: HistoricalMoment[] = [
  {
    id: "h1",
    year: 2005,
    kind: "match",
    title: "The Miracle of Istanbul",
    subtitle: "AC Milan 3-3 Liverpool (2-3 pens) — Champions League Final",
    detail: "Three down at half-time to prime Milan, Liverpool scored three in six second-half minutes before Dudek's wobbly-legs shootout heroics completed football's most famous comeback.",
    tags: ["liverpool", "champions league", "comeback", "final", "milan", "gerrard"],
    stat: { label: "Win probability at HT", value: "0.9%" },
  },
  {
    id: "h2",
    year: 2017,
    kind: "match",
    title: "La Remontada",
    subtitle: "Barcelona 6-1 PSG — Champions League Round of 16",
    detail: "Needing four without reply after a 4-0 first-leg collapse, Barcelona scored three in the final seven minutes — Sergi Roberto's 95th-minute finish remains the loudest measured crowd noise at Camp Nou.",
    tags: ["barcelona", "psg", "comeback", "champions league", "neymar", "camp nou"],
    stat: { label: "Aggregate probability at 88'", value: "1.2%" },
  },
  {
    id: "h3",
    year: 2014,
    kind: "match",
    title: "The Mineirazo",
    subtitle: "Brazil 1-7 Germany — World Cup Semi-final",
    detail: "The host nation conceded five goals in eighteen first-half minutes. The most statistically improbable result in World Cup history, and the night xG models entered mainstream vocabulary.",
    tags: ["brazil", "germany", "world cup", "semi-final", "collapse"],
    stat: { label: "Pre-match model odds", value: "1 in 4,000" },
  },
  {
    id: "h4",
    year: 2012,
    kind: "moment",
    title: "93:20",
    subtitle: "Agüero wins City the title with the last kick of the season",
    detail: "QPR led 2-1 as stoppage time began. Džeko headed level at 91:15; Agüero's swivel-and-strike at 93:20 won Manchester City their first title in 44 years — the tightest title finish in English history.",
    tags: ["man city", "aguero", "premier league", "title", "last minute", "qpr"],
    stat: { label: "Title probability at 90:00", value: "7%" },
  },
  {
    id: "h5",
    year: 2016,
    kind: "moment",
    title: "The 5000-1 Season",
    subtitle: "Leicester City win the Premier League",
    detail: "A squad assembled for £57M outran, out-countered and out-believed the £2B super clubs. Vardy, Mahrez, Kanté — the most improbable league title in modern sport.",
    tags: ["leicester", "premier league", "underdog", "vardy", "title"],
    stat: { label: "Pre-season odds", value: "5000/1" },
  },
  {
    id: "h6",
    year: 2012,
    kind: "milestone",
    title: "91 Goals in a Calendar Year",
    subtitle: "Messi breaks Gerd Müller's 40-year record",
    detail: "Across 69 matches for Barcelona and Argentina in 2012, Messi scored 91 times — a scoring year no model expects to see repeated.",
    tags: ["messi", "barcelona", "record", "goals", "milestone"],
    stat: { label: "Goals per match, 2012", value: "1.32" },
  },
  {
    id: "h7",
    year: 2018,
    kind: "rivalry",
    title: "El Clásico: The Century's Defining Rivalry",
    subtitle: "Real Madrid vs Barcelona — 250+ meetings",
    detail: "Messi vs Ronaldo turned a national rivalry into the most-watched recurring fixture on Earth. Peak era 2009-2018: 18 Clásicos decided titles across four competitions.",
    tags: ["real madrid", "barcelona", "el clasico", "rivalry", "messi", "ronaldo"],
    stat: { label: "Global TV audience (peak)", value: "650M" },
  },
  {
    id: "h8",
    year: 1999,
    kind: "match",
    title: "Camp Nou '99",
    subtitle: "Manchester United 2-1 Bayern Munich — Champions League Final",
    detail: "Trailing from the sixth minute, United scored twice in injury time through Sheringham and Solskjær to complete the Treble. 'Football, bloody hell.'",
    tags: ["man united", "bayern", "champions league", "final", "comeback", "treble"],
    stat: { label: "Seconds between goals", value: "102" },
  },
  {
    id: "h9",
    year: 2023,
    kind: "milestone",
    title: "Haaland's 36",
    subtitle: "The Premier League single-season scoring record falls",
    detail: "In his debut English season, Haaland scored 36 league goals, breaking a record that had stood since the 42-game era — while City completed the Treble.",
    tags: ["haaland", "man city", "record", "goals", "premier league"],
    stat: { label: "Minutes per goal", value: "77" },
  },
  {
    id: "h10",
    year: 2025,
    kind: "match",
    title: "Munich's Coronation",
    subtitle: "PSG 5-0 Inter — Champions League Final",
    detail: "The biggest final winning margin in the competition's history. Doué scored twice at 19 as Luis Enrique's positionless press completed European football's newest dynasty-in-waiting.",
    tags: ["psg", "inter", "champions league", "final", "doue", "record"],
    stat: { label: "Final margin", value: "Record 5-0" },
  },
  {
    id: "h11",
    year: 1986,
    kind: "moment",
    title: "The Goal of the Century",
    subtitle: "Maradona vs England — World Cup Quarter-final",
    detail: "Four minutes after the Hand of God, Maradona ran 60 yards through six challenges for the greatest individual goal ever scored. Two moments, one match, the whole sport's mythology.",
    tags: ["maradona", "argentina", "world cup", "goal", "england"],
    stat: { label: "Touches on the run", value: "44 in 10.6s" },
  },
  {
    id: "h12",
    year: 2019,
    kind: "match",
    title: "Anfield 4-0",
    subtitle: "Liverpool 4-0 Barcelona — Champions League Semi-final",
    detail: "Down 3-0 from the first leg, without Salah and Firmino, Liverpool won 4-0 — sealed by Origi from the fastest corner routine ever taken in a semi-final.",
    tags: ["liverpool", "barcelona", "comeback", "champions league", "anfield", "corner"],
    stat: { label: "Corner-to-goal time", value: "2.8s" },
  },
];

/** Very small NL search: score by tag/title/keyword hits. */
export function searchHistory(query: string): HistoricalMoment[] {
  const q = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (q.length === 0) return historicalMoments;
  return historicalMoments
    .map((m) => {
      const hay = `${m.title} ${m.subtitle} ${m.detail} ${m.tags.join(" ")} ${m.year} ${m.kind}`.toLowerCase();
      const score = q.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}
