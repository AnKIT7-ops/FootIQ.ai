import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Radio, Newspaper, Sparkles, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { pageEntries, legalEntries } from "@/lib/nav";

const primary = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/matches", label: "Matches", icon: Radio },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/predictions", label: "AI", icon: Sparkles },
];

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape closes the sheet and returns focus to its trigger
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      <nav
        className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl px-2 py-1.5 shadow-2xl lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Mobile navigation"
      >
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive ? "text-accent-ink" : "text-ink-3",
              )
            }
          >
            <item.icon className="size-5" aria-hidden />
            {item.label}
          </NavLink>
        ))}
        <button
          ref={moreButtonRef}
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium text-ink-3"
          aria-label="More pages"
          aria-expanded={moreOpen}
        >
          <Menu className="size-5" aria-hidden />
          More
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm lg:hidden"
              onClick={() => setMoreOpen(false)}
              aria-hidden
            />
            <motion.div
              ref={sheetRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-8 lg:hidden"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
              role="dialog"
              aria-modal="true"
              aria-label="All pages"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">All experiences</p>
                <button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pageEntries.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    onClick={() => setMoreOpen(false)}
                    className="rounded-xl border border-line bg-surface-2 px-3.5 py-3 transition-colors hover:border-line-strong"
                  >
                    <p className="text-[13.5px] font-semibold text-ink">{p.label}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{p.sub}</p>
                  </Link>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4">
                {legalEntries.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    onClick={() => setMoreOpen(false)}
                    className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3 hover:text-ink"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
