import { type ReactNode } from "react";
import { SectionHeader } from "@/components/ui/Card";

/**
 * Shared layout for legal/informational pages — floodlit card, mono eyebrow,
 * consistent prose rhythm without pulling in a typography plugin.
 */
export function ProsePage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader level={1} eyebrow={eyebrow} title={title} />
      {updated && <p className="mb-6 font-mono text-label uppercase tracking-wider text-ink-3">Last updated: {updated}</p>}
      <div className="space-y-8">{children}</div>
    </div>
  );
}

export function ProseSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="display mb-2.5 text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-3 text-body leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function ProseList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[0.62em] size-1 shrink-0 rounded-full bg-accent" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
