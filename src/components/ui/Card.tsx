import { type ReactNode } from "react";
import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  hover = false,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
}) {
  if (hover) {
    // clickable cards act as buttons: focusable + Enter/Space activation
    const interactive = onClick
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": ariaLabel,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          },
        }
      : {};
    return (
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={onClick ? { scale: 0.985 } : undefined}
        transition={SPRING}
        onClick={onClick}
        {...interactive}
        className={cn(
          "card transition-colors duration-200 hover:border-line-strong",
          onClick && "cursor-pointer",
          className,
        )}
      >
        {children}
      </motion.div>
    );
  }
  return <div className={cn("card", className)}>{children}</div>;
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
  /** Heading level — pass 1 for the page-title instance so every page has exactly one h1. */
  level?: 1 | 2 | 3;
}) {
  const Heading = `h${level}` as const;
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <Heading className="display text-xl font-bold text-ink md:text-2xl">{title}</Heading>
      </div>
      {/* min-w-0, not shrink-0: a wide action (Tabs) must scroll inside its own
          box — a non-shrinking one widens the mobile layout viewport. */}
      {action && <div className="min-w-0 max-w-full">{action}</div>}
    </div>
  );
}
