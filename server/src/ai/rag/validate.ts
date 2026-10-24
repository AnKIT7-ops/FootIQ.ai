import type { KnowledgeDoc } from "../../providers/guardian";

/**
 * The knowledge-source gate. Every fetched article either enters the index or
 * is counted under the reason it didn't — the counts land in job_runs.detail,
 * so each sync leaves an audit line of what was rejected and why.
 */

export type RejectReason = "empty" | "too_short" | "too_old" | "boilerplate" | "already_held" | "duplicate";
export type HashedDoc = KnowledgeDoc & { hash: string };

export const MIN_WORDS = 150;
export const MAX_AGE_DAYS = 30;
/**
 * Templated service pages that clear the word floor but answer nothing — the
 * first real fetch (2026-10-24) held daily "Premier League today: How to watch
 * X v Y, TV channels & live stream" listings.
 */
const BOILERPLATE_TITLE = /\bhow to watch\b|\blive stream\b|\btv channels?\b/i;

export function validateDocs(
  docs: HashedDoc[],
  opts: { knownIds: Set<string>; knownHashes: Set<string>; now: Date },
): { accepted: HashedDoc[]; rejected: Record<RejectReason, number> } {
  const rejected: Record<RejectReason, number> = { empty: 0, too_short: 0, too_old: 0, boilerplate: 0, already_held: 0, duplicate: 0 };
  const accepted: HashedDoc[] = [];
  const seenHashes = new Set(opts.knownHashes);
  const oldest = opts.now.getTime() - MAX_AGE_DAYS * 86_400_000;
  for (const doc of docs) {
    const reason: RejectReason | null = opts.knownIds.has(doc.id)
      ? "already_held"
      : !doc.body
        ? "empty"
        : wordCount(doc.body) < MIN_WORDS
          ? "too_short"
          : !(new Date(doc.publishedIso).getTime() >= oldest)
            ? "too_old"
            : BOILERPLATE_TITLE.test(doc.title)
              ? "boilerplate"
              : seenHashes.has(doc.hash)
                ? "duplicate"
                : null;
    if (reason) rejected[reason]++;
    else {
      seenHashes.add(doc.hash);
      accepted.push(doc);
    }
  }
  return { accepted, rejected };
}

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** sha256 of the whitespace/case-normalized body: the same article re-published under a new id hashes the same. */
export async function contentHash(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body.toLowerCase().replace(/\s+/g, " ").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
