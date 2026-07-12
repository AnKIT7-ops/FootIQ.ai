import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ShareBar } from "@/components/ui/ShareBar";
import { historicalMoments } from "@/lib/repositories/history";
import { momentPath, resolveMoment } from "@/lib/slugs";
import { articleJsonLd, usePageMeta } from "@/lib/seo";

export default function HistoryMoment() {
  const { slug } = useParams();
  const moment = resolveMoment(slug);

  usePageMeta(
    moment
      ? {
          title: `${moment.title} (${moment.year})`,
          description: `${moment.subtitle} — ${moment.detail.slice(0, 140)}`,
          path: momentPath(moment),
          type: "article",
          jsonLd: articleJsonLd({
            headline: `${moment.title} (${moment.year})`,
            description: moment.subtitle,
            path: momentPath(moment),
            publishedAt: `${moment.year}-01-01`,
          }),
          breadcrumbs: [
            { name: "History", path: "/history" },
            { name: moment.title, path: momentPath(moment) },
          ],
        }
      : { title: "History", path: "/history" },
  );

  if (!moment) return <Navigate to="/history" replace />;

  const idx = historicalMoments.findIndex((m) => m.id === moment.id);
  const next = historicalMoments[(idx + 1) % historicalMoments.length];
  const related = historicalMoments
    .filter((m) => m.id !== moment.id && (m.kind === moment.kind || m.tags.some((t) => moment.tags.includes(t))))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        trail={[
          { name: "History", path: "/history" },
          { name: moment.title, path: momentPath(moment) },
        ]}
      />

      <Card className="p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="accent">{moment.year}</Badge>
          <Badge variant="outline">{moment.kind}</Badge>
          {moment.tags.map((t) => (
            <Badge key={t} variant="neutral">{t}</Badge>
          ))}
        </div>
        <SectionHeader level={1} title={moment.title} className="mb-1" />
        <p className="mb-4 text-[15px] text-ink-2">{moment.subtitle}</p>
        <p className="text-[14px] leading-relaxed text-ink-2">{moment.detail}</p>
        <div className="mt-5 inline-block rounded-xl bg-surface-2 px-4 py-3">
          <p className="font-mono text-xl font-bold text-accent-ink">{moment.stat.value}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">{moment.stat.label}</p>
        </div>
      </Card>

      <ShareBar title={moment.title} path={momentPath(moment)} kind={`Football History · ${moment.year}`} stat={`${moment.stat.value} ${moment.stat.label}`} />

      <div className="flex items-center justify-between">
        <Link to="/history" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3 transition-colors hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden /> All moments
        </Link>
        <Link to={momentPath(next)} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent-ink transition-colors hover:text-ink">
          {next.title} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {related.length > 0 && (
        <section aria-label="Related moments">
          <SectionHeader eyebrow="More from the archive" title="Related moments" />
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((m) => (
              <Link key={m.id} to={momentPath(m)} className="group">
                <Card hover className="flex h-full flex-col p-4">
                  <Badge variant="accent" className="mb-2 self-start">{m.year}</Badge>
                  <p className="display text-[13.5px] font-bold leading-snug text-ink transition-colors group-hover:text-accent-ink">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-3">{m.subtitle}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
