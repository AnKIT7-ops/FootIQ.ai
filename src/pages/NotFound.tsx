import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { usePageMeta } from "@/lib/seo";

export default function NotFound() {
  usePageMeta({
    title: "Page not found",
    description: "That page doesn't exist on FootIQ.",
    noIndex: true,
  });

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <p className="eyebrow">Off the pitch</p>
      <h1 className="display mt-2 text-6xl font-black text-ink md:text-7xl">404</h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-2">
        That page doesn't exist — the ball went out for a throw-in. Head back home or open the search with{" "}
        <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">Ctrl K</kbd>.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-[#04110c] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to Home
        </Link>
        <Link
          to="/matches"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          <Compass className="size-4" aria-hidden />
          Explore matches
        </Link>
      </div>
    </div>
  );
}
