import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AIMeta } from "@/components/ui/AIMeta";
import { BookmarkButton } from "@/components/ui/FavoriteButton";
import { ShareBar } from "@/components/ui/ShareBar";
import { WaitlistForm } from "@/components/ui/Waitlist";
import { contentBySlug, contentKindLabels, contentLibrary } from "@/lib/repositories/content";
import { articleJsonLd, usePageMeta } from "@/lib/seo";
import { useEffect } from "react";
import { recordView } from "@/lib/recent";

export default function IntelligenceArticle() {
  const { slug } = useParams();
  const article = slug ? contentBySlug(slug) : undefined;
  useEffect(() => {
    if (!article) return;
    recordView({ kind: "intel", id: article.slug, label: article.title.length > 48 ? article.title.slice(0, 45) + "…" : article.title, sub: "Intelligence", path: `/intelligence/${article.slug}` });
  }, [article]);

  usePageMeta(
    article
      ? {
          title: article.title,
          description: article.dek,
          path: `/intelligence/${article.slug}`,
          type: "article",
          publishedAt: article.publishedAt,
          jsonLd: articleJsonLd({
            headline: article.title,
            description: article.dek,
            path: `/intelligence/${article.slug}`,
            publishedAt: article.publishedAt,
            aiGenerated: true,
          }),
          breadcrumbs: [
            { name: "Intelligence", path: "/intelligence" },
            { name: contentKindLabels[article.kind], path: `/intelligence/${article.slug}` },
          ],
        }
      : { title: "Intelligence", path: "/intelligence" },
  );

  if (!article) return <Navigate to="/intelligence" replace />;

  const related = contentLibrary()
    .filter((a) => a.slug !== article.slug && (a.kind === article.kind || a.tags.some((t) => article.tags.includes(t))))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        trail={[
          { name: "Intelligence", path: "/intelligence" },
          { name: contentKindLabels[article.kind], path: `/intelligence/${article.slug}` },
        ]}
      />

      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="iq">{contentKindLabels[article.kind]}</Badge>
          <span className="font-mono text-micro uppercase tracking-wider text-ink-3">
            {article.publishedAt} · {article.readMinutes} min read
          </span>
        </div>
        <SectionHeader level={1} title={article.title} className="mb-2" />
        <p className="text-prose leading-relaxed text-ink-2">{article.dek}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <BookmarkButton entry={{ kind: "intel", refId: article.slug, title: article.title, path: `/intelligence/${article.slug}` }} />
        <ShareBar title={article.title} path={`/intelligence/${article.slug}`} kind={contentKindLabels[article.kind]} stat={`Confidence ${article.confidence}%`} />
      </div>

      {article.sections.map((s, i) => (
        <Card key={i} className="p-5 md:p-6">
          {s.heading && <h2 className="display mb-3 text-lg font-bold text-ink">{s.heading}</h2>}
          <div className="space-y-3">
            {s.paragraphs.map((p, j) => (
              <p key={j} className="text-body leading-relaxed text-ink-2">
                {p}
              </p>
            ))}
          </div>
          {s.bullets && s.bullets.length > 0 && (
            <ul className="mt-4 space-y-2">
              {s.bullets.map((b, j) => (
                <li key={j} className="flex gap-2 text-ui leading-relaxed text-ink-2">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <AIMeta confidence={article.confidence} generatedAt={article.publishedAt} sources={article.sources} />

      <Card className="p-5">
        <p className="eyebrow mb-1">Weekly in your inbox</p>
        <p className="mb-3 text-ui text-ink-2">One digest, every week — previews, form inflections and market movement. No noise.</p>
        <WaitlistForm compact />
      </Card>

      {related.length > 0 && (
        <section aria-label="Related intelligence">
          <SectionHeader title="Related intelligence" />
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((a) => (
              <Link key={a.slug} to={`/intelligence/${a.slug}`} className="group">
                <Card hover className="flex h-full flex-col p-4">
                  <Badge variant="iq" className="mb-2 self-start">
                    {contentKindLabels[a.kind]}
                  </Badge>
                  <p className="display text-ui font-bold leading-snug text-ink transition-colors group-hover:text-accent-ink">{a.title}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 font-mono text-micro uppercase tracking-wider text-ink-3">
                    Read <ArrowRight className="size-3" aria-hidden />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
