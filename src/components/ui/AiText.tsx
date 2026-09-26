import type { ReactNode } from "react";

/**
 * Tiny renderer for the provider's constrained markdown: paragraphs, "-" bullets, **bold**.
 * Dependency-free so the shell's ChatDock can use it without pulling in the AI panels.
 */
export function AiText({ text }: { text: string }) {
  const bold = (line: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="text-ink">{part.slice(2, -2)}</strong> : part,
    );
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${blocks.length}`} className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-iq" aria-hidden />
              <span>{bold(b)}</span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) bullets.push(line.replace(/^[-*]\s+/, ""));
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`}>{bold(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-2.5">{blocks}</div>;
}
