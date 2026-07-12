/**
 * Real imagery via public CDNs (FotMob crests/portraits, flagcdn flags).
 * Every consumer falls back to the local SVG crest / initials avatar / emoji
 * when a URL is missing or fails to load, so the app still works fully offline.
 * IDs resolved and verified against the live CDN on 2026-07-09 (scripts/resolve-images.mjs).
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

const playerPhotoIds: Record<string, number> = {
  saka: 961995,
  odegaard: 534670,
  rice: 654096,
  saliba: 955406,
  raya: 562727,
  haaland: 737066,
  rodri: 675088,
  foden: 815006,
  salah: 292462,
  vvd: 209405,
  wirtz: 1152455,
  isak: 690107,
  palmer: 1096353,
  caicedo: 1137668,
  bruno: 422685,
  mainoo: 1292810,
  kudus: 891743,
  gordon: 906937,
  tonali: 867414,
  watkins: 540088,
  mbappe: 701154,
  bellingham: 1077894,
  vinicius: 846033,
  yamal: 1467236,
  pedri: 1083323,
  raphinha: 696679,
  kane: 194165,
  musiala: 1156141,
  olise: 1029063,
  dembele: 692984,
  vitinha: 1061249,
  doue: 1339208,
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

export function playerPhotoUrl(playerId: string | undefined): string | undefined {
  if (!playerId) return undefined;
  const id = playerPhotoIds[playerId];
  return id ? `https://images.fotmob.com/image_resources/playerimages/${id}.png` : undefined;
}

export function flagUrl(nationality: string, width: 20 | 40 = 40): string | undefined {
  const code = nationFlagCodes[nationality];
  return code ? `https://flagcdn.com/w${width}/${code}.png` : undefined;
}
