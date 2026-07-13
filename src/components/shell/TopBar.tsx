import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, HelpCircle, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/lib/hooks";
import { Logo } from "./Logo";
import { Avatar } from "@/components/ui/Avatar";

// the notification feed derives from the dataset — keep it out of the shell
// chunk and hydrate the bell after first paint (same idea as CommandPalette)
const NotificationCenter = lazy(() =>
  import("./NotificationCenter").then((m) => ({ default: m.NotificationCenter })),
);

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [theme, toggleTheme] = useTheme();
  const [bellReady, setBellReady] = useState(false);
  useEffect(() => setBellReady(true), []); // mount lazy bell post-paint

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <div className="lg:hidden">
          <Logo compact />
        </div>

        <button
          onClick={onOpenSearch}
          className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-surface px-3.5 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:max-w-xs lg:max-w-sm"
          aria-label="Open universal search"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">Search players, teams, anything…</span>
          <kbd className="ml-auto hidden shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3 md:block">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {bellReady ? (
            <Suspense
              fallback={
                <span className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-3" aria-hidden>
                  <Bell className="size-4" />
                </span>
              }
            >
              <NotificationCenter />
            </Suspense>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-3" aria-hidden>
              <Bell className="size-4" />
            </span>
          )}

          <button
            onClick={() => window.dispatchEvent(new Event("footiq:tour"))}
            className="hidden size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink sm:flex"
            aria-label="What is FootIQ? Open the welcome tour"
            title="What is FootIQ?"
          >
            <HelpCircle className="size-4" aria-hidden />
          </button>

          <button
            onClick={toggleTheme}
            className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
          </button>

          <Link to="/profile" aria-label="Your profile" className="ml-0.5 rounded-full transition-transform hover:scale-105">
            <Avatar name="Ankit L" size={34} />
          </Link>
        </div>
      </div>
    </header>
  );
}
