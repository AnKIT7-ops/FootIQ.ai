import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, CornerDownLeft, Flame, Mic, MicOff, Search, Sparkles, UserRound, UsersRound, Shield, FileText, Compass } from "lucide-react";
import { recentSearches, recordSearch, runSearch, trendingSearches, type SearchItem } from "@/lib/search";
import { useFocusTrap, useVoiceInput } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** Highlight the matched part of a result label (whole query, else first word). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  let term = q;
  let at = q ? lower.indexOf(q) : -1;
  if (at < 0 && q.includes(" ")) {
    term = q.split(/\s+/)[0];
    at = lower.indexOf(term);
  }
  if (at < 0 || !term) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-iq/25 px-px text-inherit">{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

const kindIcon = {
  player: UserRound,
  team: Shield,
  manager: UsersRound,
  news: FileText,
  intel: Sparkles,
  page: Compass,
  action: Compass,
} as const;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { listening, supported, start, stop } = useVoiceInput((text) => setQuery(text));

  const results = useMemo(() => runSearch(query), [query]);

  // focus lands on the search input (first focusable), stays inside, returns to the opener on close
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    } else {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // dialog-level Escape: works no matter which control inside has focus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => setCursor(0), [query]);

  const go = (item: SearchItem) => {
    if (query.trim()) recordSearch(query);
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (e.key === "Enter") {
      if (results[cursor]) go(results[cursor]);
      else if (query.trim().length > 6) {
        // long natural-language queries route to the AI Scout
        recordSearch(query);
        onClose();
        navigate(`/scout?q=${encodeURIComponent(query)}`);
      }
    }
  };

  // keyboard-summoned and used constantly: appears and leaves instantly, no animation
  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/55" onClick={onClose} aria-hidden />
          <div
            ref={dialogRef}
            className="fixed inset-x-3 top-[12vh] z-50 mx-auto max-w-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Universal search"
          >
            <div className="panel-float overflow-hidden rounded-2xl shadow-2xl">
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search or ask anything…"
                  className="h-13 w-full bg-transparent py-4 text-prose text-ink outline-none placeholder:text-ink-3"
                  aria-label="Search query"
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="palette-results"
                  aria-activedescendant={results[cursor] ? `palette-option-${results[cursor].id}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
                {supported && (
                  <button
                    onClick={listening ? stop : start}
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                      listening ? "bg-bad/15 text-bad" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                    )}
                    aria-label={listening ? "Stop voice input" : "Search by voice"}
                  >
                    {listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
                  </button>
                )}
              </div>

              {listening && (
                <p className="border-b border-line px-4 py-2 font-mono text-label uppercase tracking-wider text-bad">
                  ● Listening… speak now
                </p>
              )}

              {query === "" ? (
                <div className="space-y-4 p-4">
                  {recentSearches().length > 0 && (
                    <div>
                      <p className="eyebrow mb-2 flex items-center gap-1.5">
                        <Clock3 className="size-3" aria-hidden /> Recent
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches().map((s) => (
                          <button
                            key={s}
                            onClick={() => setQuery(s)}
                            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="eyebrow mb-2 flex items-center gap-1.5">
                      <Flame className="size-3" aria-hidden /> Trending
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {trendingSearches().map((s) => (
                        <button
                          key={s}
                          onClick={() => setQuery(s)}
                          className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="p-5 text-sm text-ink-2">
                  No direct matches. Press <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-micro">Enter</kbd> to
                  ask AI Scout: <span className="italic text-ink">"{query}"</span>
                </div>
              ) : (
                <ul className="max-h-[46vh] overflow-y-auto p-2" role="listbox" id="palette-results">
                  {results.map((r, i) => {
                    const Icon = kindIcon[r.kind];
                    return (
                      <li key={r.id} id={`palette-option-${r.id}`} role="option" aria-selected={i === cursor}>
                        <button
                          onClick={() => go(r)}
                          onMouseEnter={() => setCursor(i)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            i === cursor ? "bg-surface-3" : "hover:bg-surface-2",
                          )}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-3">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-ui font-semibold text-ink">
                              <Highlight text={r.label} query={query} />
                            </span>
                            <span className="block truncate text-label text-ink-3">{r.sub}</span>
                          </span>
                          <span className="shrink-0 font-mono text-micro uppercase tracking-wider text-ink-3">{r.kind}</span>
                          {i === cursor && <CornerDownLeft className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
