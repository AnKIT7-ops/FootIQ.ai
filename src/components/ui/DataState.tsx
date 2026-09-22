import { CloudOff, Loader2, CalendarOff } from "lucide-react";
import type { ReactNode } from "react";
import type { RepoStatus } from "@/lib/repositories/store";
import { EmptyState } from "./EmptyState";

/**
 * Renders the honest answer for a live-tier dataset that has nothing to show.
 *
 * There are three reasons a fixture list is empty and they are NOT the same
 * thing, though they used to render identically (as bundled demo fixtures):
 *
 *   loading      — the request is in flight; say nothing yet
 *   unavailable  — no backend configured, or it can't be reached
 *   error        — the backend answered with a failure
 *   ready + []   — the backend answered, and there genuinely are no matches
 *
 * Only the last one is "No live matches". The others are "we don't know", and
 * claiming otherwise is how a demo fixture ends up presented as live football.
 */
export function DataState({
  status,
  empty,
  emptyTitle,
  emptyBody,
  loadingLabel = "Loading fixtures…",
  children,
}: {
  status: RepoStatus;
  /** True when the payload arrived but holds nothing. */
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  loadingLabel?: string;
  children?: ReactNode;
}) {
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-caption text-ink-3" role="status">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        {loadingLabel}
      </div>
    );
  }

  if (status === "unavailable" || status === "error") {
    return (
      <EmptyState
        icon={CloudOff}
        title="Data temporarily unavailable"
        body="We couldn't reach the football data service, so there's nothing to show rather than something made up. Try again shortly."
      />
    );
  }

  if (empty) return <EmptyState icon={CalendarOff} title={emptyTitle} body={emptyBody}>{children}</EmptyState>;

  return null;
}

/** True when the UI should render the DataState placeholder instead of a list. */
export const showsPlaceholder = (status: RepoStatus, empty: boolean): boolean => status !== "ready" || empty;
