import { CalendarClock } from "lucide-react";
import type { CompetitionDto } from "@shared/contracts";
import { daysUntil } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * Where each competition's season currently stands.
 *
 * Costs no request: season dates and matchday ride on the competitions
 * snapshot that /api/competitions already serves. Renders nothing until that
 * lands, rather than guessing.
 *
 * The three states are genuinely different facts and read differently:
 *   upcoming    — "starts in 21 days" (there is no table or matchday yet)
 *   in-progress — "Matchday 3"
 *   ended       — "season ended" (the table is last season's, not a live one)
 */
export function SeasonStatus({ competitions, className }: { competitions: CompetitionDto[]; className?: string }) {
  const withSeason = competitions.filter((c) => c.season);
  if (withSeason.length === 0) return null;

  const order = { "in-progress": 0, upcoming: 1, ended: 2 } as const;
  const sorted = [...withSeason].sort((a, b) => order[a.season!.state] - order[b.season!.state]);

  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>
      {sorted.map((c) => (
        <span
          key={c.code}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-caption text-ink-3"
          title={`${c.name}: ${new Date(c.season!.startDateIso).toLocaleDateString()} – ${new Date(c.season!.endDateIso).toLocaleDateString()}`}
        >
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <span className="font-semibold text-ink-2">{c.name}</span>
          <span aria-hidden>·</span>
          <span>{seasonLabel(c)}</span>
        </span>
      ))}
    </div>
  );
}

function seasonLabel(c: CompetitionDto): string {
  const s = c.season!;
  if (s.state === "upcoming") {
    const days = daysUntil(s.startDateIso);
    if (days === 0) return "starts today";
    if (days === 1) return "starts tomorrow";
    return `starts in ${days} days`;
  }
  if (s.state === "ended") return "season ended";
  // A season can be in progress before its first matchday is published.
  return s.currentMatchday ? `Matchday ${s.currentMatchday}` : "in progress";
}
