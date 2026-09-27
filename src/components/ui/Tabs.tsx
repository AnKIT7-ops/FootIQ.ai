import { useRef } from "react";
import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Animated segmented control with roving-tabindex arrow-key navigation. */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
  id = "tabs",
}: {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const moveFocus = (from: number, dir: -1 | 1) => {
    const next = (from + dir + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn("no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface-2 p-1", className)}
    >
      {tabs.map((t, i) => {
        const selected = t.value === active;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                moveFocus(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                moveFocus(i, -1);
              }
            }}
            className={cn(
              "relative shrink-0 rounded-full px-3.5 py-1.5 text-ui font-medium transition-colors",
              selected ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-full bg-surface-3"
                transition={SPRING}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
