/**
 * Sentence-packed chunking. Sentences are never split; each chunk packs
 * sentences until it reaches `targetWords`, and the next chunk repeats the
 * last `overlap` sentences so a fact straddling the boundary survives in one
 * piece. The header ("title (publisher, date): ") gives every chunk the
 * context its own sentences lack ("he scored twice" — who, in which match?).
 *
 * The options exist for the retrieval experiments (docs/RAG.md); production
 * uses the defaults.
 */

export interface ChunkOptions {
  targetWords: number;
  overlap: number;
  header: boolean;
}

export const DEFAULT_CHUNKING: ChunkOptions = { targetWords: 150, overlap: 1, header: true };

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

export function chunkDoc(
  doc: { title: string; source: string; publishedIso: string; body: string },
  opts: ChunkOptions = DEFAULT_CHUNKING,
): string[] {
  const sentences = [...segmenter.segment(doc.body)].map((s) => s.segment.trim()).filter(Boolean);
  const words = sentences.map((s) => s.split(/\s+/).length);
  const prefix = opts.header ? `${doc.title} (${doc.source}, ${doc.publishedIso.slice(0, 10)}): ` : "";
  const chunks: string[] = [];
  let start = 0;
  while (start < sentences.length) {
    let end = start;
    let n = 0;
    while (end < sentences.length && (n < opts.targetWords || end === start)) n += words[end++];
    chunks.push(prefix + sentences.slice(start, end).join(" "));
    if (end >= sentences.length) break;
    // Step back for overlap, but always move forward at least one sentence.
    start = Math.max(end - opts.overlap, start + 1);
  }
  return chunks;
}
