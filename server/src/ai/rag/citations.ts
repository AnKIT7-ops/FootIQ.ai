import type { AiSource } from "../../../../shared/contracts";
import type { RetrievedChunk } from "./retrieve";

/**
 * Turns the model's [n] markers into a source list it can't lie about.
 * Markers pointing at no retrieved chunk are deleted (a citation to nothing is
 * worse than none). Cited chunks are renumbered 1..m in order of first use,
 * and two chunks of one article share a number — the reader sees articles,
 * not chunks. Accepts "[2]", "[2, 3]" and "[2][3]".
 */
export function resolveCitations(text: string, chunks: RetrievedChunk[]): { text: string; sources: AiSource[] } {
  const numberByUrl = new Map<string, number>();
  const sources: AiSource[] = [];
  const out = text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_m, list: string) => {
    const nums = new Set<number>();
    for (const raw of list.split(",")) {
      const chunk = chunks[Number(raw.trim()) - 1];
      if (!chunk) continue;
      let n = numberByUrl.get(chunk.url);
      if (n === undefined) {
        n = sources.length + 1;
        numberByUrl.set(chunk.url, n);
        sources.push({ n, title: chunk.title, url: chunk.url, publisher: chunk.source, publishedIso: chunk.publishedIso });
      }
      nums.add(n);
    }
    return nums.size ? `[${[...nums].join(", ")}]` : "";
  });
  // Deleting a marker can leave "word ." — close the gap. Newlines are kept for bullets.
  return { text: out.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim(), sources };
}
