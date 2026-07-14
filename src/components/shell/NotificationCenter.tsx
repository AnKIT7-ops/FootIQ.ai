import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const kindDot: Record<string, string> = {
  match: "bg-accent",
  news: "bg-chart-2",
  transfer: "bg-chart-2",
  "ai-report": "bg-iq",
  digest: "bg-iq",
};

/**
 * Bell + panel. Lazy-mounted from TopBar (same pattern as CommandPalette) so
 * the shell chunk stays free of the dataset the feed derives from.
 */
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { items, unread, markRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink",
          open && "border-line-strong text-ink",
        )}
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden />}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="glass absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-2xl"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="eyebrow">Notifications</p>
                {unread > 0 && (
                  <button
                    className="font-mono text-micro uppercase tracking-wider text-accent-ink hover:underline"
                    onClick={() => markRead(items.map((n) => n.id))}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className="border-b border-line last:border-0">
                    <Link
                      to={n.path}
                      onClick={() => {
                        markRead([n.id]);
                        setOpen(false);
                      }}
                      className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2", n.read && "opacity-60")}
                    >
                      <span className={cn("mt-1 size-2 shrink-0 rounded-full", kindDot[n.kind] ?? "bg-accent")} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-ui font-semibold text-ink">{n.title}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-ink-2 line-clamp-2">{n.body}</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="px-4 py-6 text-center text-ui text-ink-3">
                    Follow teams or players and match reminders, news and fresh AI reports land here.
                  </li>
                )}
              </ul>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="block border-t border-line px-4 py-2.5 text-center font-mono text-micro uppercase tracking-wider text-ink-3 transition-colors hover:text-ink"
              >
                Notification preferences
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
