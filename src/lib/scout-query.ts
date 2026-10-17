import type { Position } from "@/data/types";
import type { ScoutFilters } from "@shared/contracts";
import { TRAITS, type Trait } from "@/lib/player-stats";

/**
 * What AI Scout understood from a plain-language request. Everything here maps
 * to a field the FPL feed actually publishes; anything the user asked for that
 * doesn't is listed in `ignored`, so an unapplied constraint never passes as applied.
 */
export interface ParsedQuery {
  maxAge?: number;
  /** FPL price, £m, strictly below. */
  maxPrice?: number;
  positions: Position[];
  traits: Trait[];
  chips: string[];
  /** The user's own words for constraints we can't search on. */
  ignored: string[];
}

// FPL only has GK/DEF/MID/FWD — a winger is listed as a forward or a midfielder,
// so "wide" can't be told apart from "central". The position is searched; the role isn't.
const WIDE = /\bwingers?\b|\bwide\b|\bwing\b(?![ -]?backs?)/i;

const POSITIONS: Array<[RegExp, Position, string]> = [
  [/\bwingers?\b|\bwide\b|\bwing\b(?![ -]?backs?)|striker|forward|number 9|\bno9\b|goalscorer/, "FW", "forward"],
  [/midfielder|pivot|number 8|playmaker|regista|\bten\b/, "MF", "midfielder"],
  [/defender|cent(?:re|er)[ -]?backs?|\bcbs?\b|(?:full|left|right|wing)[ -]?backs?/, "DF", "defender"],
  [/keeper|goalkeeper|\bgk\b/, "GK", "goalkeeper"],
];

const TRAIT_WORDS: Array<[RegExp, Trait]> = [
  [/finish|\bscor|\bgoals\b|shooting|clinical/, "scoring"],
  [/\bpass|creat|vision|playmak|assist|chance/, "creating"],
  // "defender" is a position, not a request to excel at defending
  [/defend(?!ers?\b)|tackl|block|intercept|in the air|aerial|header/, "defending"],
  [/\bpress|work rate|\bengine\b|recover|win(s|ning)? (the )?ball/, "ball_winning"],
  [/\bsav(e|es|ing)\b|shot.?stop/, "shot_stopping"],
];

/** FPL's price range is ~£3.5m–£15m; a bigger number is a transfer fee, which no free source publishes. */
const FPL_PRICE = /(?:under|below|less than|cheaper than)\s*£\s*(\d{1,2}(?:\.\d)?)\s*m\b/i;

const UNSUPPORTED: RegExp[] = [
  /\b(?:left|right|two|weak(?:er)?)[ -]?foot(?:ed)?\b/i,
  /\b(?:fast|pac(?:e|y)|quick|rapid|speedy?|explosive)\b/i,
  /\b(?:tall|height|physical(?:ly)?|strength)\b/i,
];
const MONEY = [
  /(?:(?:under|below|less than|cheaper than|max(?:imum)?|up to|around)\s*)?(?:[€$£]\s*\d+(?:[.,]\d+)?\s*(?:bn|mn|m|million|k)?|\d+(?:[.,]\d+)?\s*(?:mn|m|million|k)\b)/i,
  /\b(?:budget|cheap|bargain|value|fee|price|cost|wages?|salary)\b/i,
];

export function parseScoutQuery(q: string): ParsedQuery {
  const s = q.toLowerCase();
  const out: ParsedQuery = { positions: [], traits: [], chips: [], ignored: [] };

  const age = s.match(/under\s*(\d{2})(?!\s*m)|younger than\s*(\d{2})|\bu(\d{2})\b/);
  if (age) {
    const v = Number(age[1] ?? age[2] ?? age[3]);
    if (v >= 16 && v <= 40) {
      out.maxAge = v;
      out.chips.push(`age < ${v}`);
    }
  } else if (/\byoung\b/.test(s)) {
    out.maxAge = 24;
    out.chips.push("age < 24");
  }

  const price = q.match(FPL_PRICE);
  if (price && Number(price[1]) >= 3 && Number(price[1]) <= 20) {
    out.maxPrice = Number(price[1]);
    out.chips.push(`FPL price < £${price[1]}m`);
  }

  for (const [re, pos, label] of POSITIONS) {
    if (re.test(s) && !out.positions.includes(pos)) {
      out.positions.push(pos);
      out.chips.push(label);
    }
  }

  for (const [re, key] of TRAIT_WORDS) {
    if (re.test(s) && !out.traits.includes(key)) {
      out.traits.push(key);
      out.chips.push(`excels: ${TRAITS[key].label}`);
    }
  }

  out.ignored = unsupportedTerms(q, out.maxPrice != null);
  return out;
}

function unsupportedTerms(q: string, priceApplied: boolean): string[] {
  const found: string[] = [];
  const add = (re: RegExp) => {
    const m = q.match(re);
    if (m) found.push(m[0].trim());
  };
  UNSUPPORTED.forEach(add);
  if (!priceApplied) MONEY.forEach(add);
  if (WIDE.test(q)) found.push("wide vs central role");
  return [...new Set(found)];
}

const POSITION_LABEL: Record<Position, string> = { GK: "goalkeeper", DF: "defender", MF: "midfielder", FW: "forward" };

/**
 * The AI's validated filters in the same shape. The AI contract has no price,
 * so the keyword parser's price and ignored-term detection still apply on top.
 */
export function fromAiFilters(f: ScoutFilters, keywords: ParsedQuery): ParsedQuery {
  const out: ParsedQuery = { positions: [...f.positions], traits: [...f.traits], chips: [], ignored: keywords.ignored };
  if (f.maxAge) {
    out.maxAge = f.maxAge;
    out.chips.push(`age < ${f.maxAge}`);
  }
  if (keywords.maxPrice != null) {
    out.maxPrice = keywords.maxPrice;
    out.chips.push(`FPL price < £${keywords.maxPrice}m`);
  }
  for (const pos of f.positions) out.chips.push(POSITION_LABEL[pos]);
  for (const t of f.traits) out.chips.push(`excels: ${TRAITS[t].label}`);
  return out;
}

/** Nothing to filter or rank on — ranking the whole league would be a confident non-answer. */
export const hasCriteria = (p: ParsedQuery): boolean =>
  p.positions.length > 0 || p.traits.length > 0 || p.maxAge != null || p.maxPrice != null;
