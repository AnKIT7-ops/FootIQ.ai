import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Globe2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { top, totals, type MetricCategory } from "@/lib/metrics";
import { usePageMeta } from "@/lib/seo";
import { api } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";

interface FleetStats {
  newsletterSubscribers: number | null;
  feedbackEntries: number | null;
  dataProvider: string;
  lastStandingsSyncAt: string | null;
}

/** Fleet-wide beta aggregates (counts only) from GET /api/stats. */
function FleetCard() {
  const [stats, setStats] = useState<FleetStats | null>(null);
  useEffect(() => {
    if (!backendConfigured) return;
    api.get<FleetStats>("/api/stats").then(setStats).catch(() => {});
  }, []);
  if (!stats) return null;
  return (
    <Card className="p-5">
      <SectionHeader eyebrow="Fleet-wide (all users)" title="Beta pulse" />
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-mono text-2xl font-bold text-ink">{stats.newsletterSubscribers ?? "—"}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">Subscribers</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-bold text-ink">{stats.feedbackEntries ?? "—"}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">Feedback</p>
        </div>
        <div>
          <p className="truncate font-mono text-[13px] font-bold leading-8 text-ink" title={stats.dataProvider}>
            {stats.dataProvider}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {stats.lastStandingsSyncAt ? `synced ${stats.lastStandingsSyncAt.slice(0, 10)}` : "data source"}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-3">
        <Globe2 className="size-3.5" aria-hidden /> Aggregate counts only — no rows, no PII leave the server.
      </p>
    </Card>
  );
}

/**
 * Product metrics dashboard — device-local counters (see lib/metrics.ts).
 * Real fleet-wide analytics live in GA4; this page answers "what does usage
 * look like" instantly, offline, with zero vendors. noIndex by design.
 */

const PANELS: Array<{ category: MetricCategory; title: string; empty: string }> = [
  { category: "entity_view", title: "Most viewed pages", empty: "Browse players and teams to populate." },
  { category: "search", title: "Top searches", empty: "Search with Ctrl+K to populate." },
  { category: "share", title: "Most shared", empty: "Share any page to populate." },
  { category: "ai_use", title: "AI feature usage", empty: "Use Scout, predictions or the concierge to populate." },
];

function MetricPanel({ category, title, empty }: { category: MetricCategory; title: string; empty: string }) {
  const rows = useMemo(() => top(category, 8), [category]);
  const max = rows[0]?.count ?? 1;
  return (
    <Card className="p-5">
      <SectionHeader eyebrow="This device" title={title} />
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-3">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
                {r.key.startsWith("/") ? (
                  <Link to={r.key} className="truncate text-ink-2 transition-colors hover:text-ink">{r.key}</Link>
                ) : (
                  <span className="truncate text-ink-2">{r.key}</span>
                )}
                <span className="font-mono text-[11px] text-ink-3">{r.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3/60">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Insights() {
  usePageMeta({
    title: "Product Insights",
    description: "Local usage metrics for this device.",
    path: "/insights",
    noIndex: true,
  });
  const t = useMemo(() => totals(), []);

  return (
    <div className="space-y-6">
      <SectionHeader
        level={1}
        eyebrow="Meaningful metrics only"
        title="Product Insights"
        action={
          <Badge variant="outline">
            <BarChart3 className="size-3" aria-hidden /> stored on this device
          </Badge>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(
          [
            ["entity_view", "Page views"],
            ["search", "Searches"],
            ["share", "Shares"],
            ["ai_use", "AI calls"],
            ["newsletter", "Signups"],
          ] as Array<[MetricCategory, string]>
        ).map(([c, label]) => (
          <Card key={c} className="p-4 text-center">
            <p className="font-mono text-2xl font-bold text-ink">{t[c]}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
          </Card>
        ))}
      </div>
      <FleetCard />
      <div className="grid gap-4 lg:grid-cols-2">
        {PANELS.map((p) => (
          <MetricPanel key={p.category} {...p} />
        ))}
      </div>
      <p className="text-[12px] leading-relaxed text-ink-3">
        Device counters are stored in this browser only — no fingerprinting, no cross-device tracking. Fleet-wide numbers are safe
        aggregates from the API; full analytics run through GA4 when configured.
      </p>
    </div>
  );
}
