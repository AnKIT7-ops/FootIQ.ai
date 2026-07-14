import { type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Guiding empty state — every empty screen tells the user what this space is
 * for and hands them the first step (pass suggestion chips / CTAs as children).
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-5 py-8 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-body font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-caption leading-relaxed text-ink-3">{body}</p>
      {children && <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">{children}</div>}
    </div>
  );
}
