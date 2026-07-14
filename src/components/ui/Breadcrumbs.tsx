import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/seo";

/**
 * Visible breadcrumb trail — pairs with the BreadcrumbList JSON-LD emitted by
 * usePageMeta({ breadcrumbs }): pass the same array to both.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 font-mono text-micro uppercase tracking-[0.14em] text-ink-3">
        <li>
          <Link to="/" className="transition-colors hover:text-ink">
            Home
          </Link>
        </li>
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1">
              <ChevronRight className="size-3 opacity-60" aria-hidden />
              {last ? (
                <span aria-current="page" className="text-ink-2">
                  {c.name}
                </span>
              ) : (
                <Link to={c.path} className="transition-colors hover:text-ink">
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
