/**
 * Real imagery via public CDNs (FotMob crests, flagcdn flags). Player photos
 * come with the synced player (Premier League CDN, see server/src/providers/fpl.ts).
 * Every consumer falls back to the local SVG crest / initials avatar / emoji
 * when a URL is missing or fails to load, so the app still works fully offline.
 * Crest IDs were resolved and verified against the live CDN on 2026-07-09.
 */

const teamLogoIds: Record<string, number> = {
  ars: 9825,
  mci: 8456,
  liv: 8650,
  che: 8455,
  mun: 10260,
  tot: 8586,
  new: 10261,
  avl: 10252,
  rma: 8633,
  bar: 8634,
  bay: 9823,
  psg: 9847,
};

const nationFlagCodes: Record<string, string> = {
  England: "gb-eng",
  Norway: "no",
  France: "fr",
  Spain: "es",
  Egypt: "eg",
  Netherlands: "nl",
  Germany: "de",
  Sweden: "se",
  Ecuador: "ec",
  Portugal: "pt",
  Ghana: "gh",
  Italy: "it",
  Brazil: "br",
  Argentina: "ar",
  Denmark: "dk",
  Croatia: "hr",
};

export function teamLogoUrl(teamId: string): string | undefined {
  const id = teamLogoIds[teamId];
  return id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : undefined;
}

export function flagUrl(nationality: string, width: 20 | 40 = 40): string | undefined {
  const code = nationFlagCodes[nationality];
  return code ? `https://flagcdn.com/w${width}/${code}.png` : undefined;
}
