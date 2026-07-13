import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, Reliability } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { IQInsight } from "@/components/ui/IQInsight";
import { news, newsById } from "@/lib/repositories/news";
import { getPlayer } from "@/lib/repositories/players";
import { getTeam } from "@/lib/repositories/teams";
import { agoFromMinutes } from "@/lib/utils";
import { articleJsonLd, usePageMeta } from "@/lib/seo";
import { newsPath, resolveNews } from "@/lib/slugs";
import { BookmarkButton } from "@/components/ui/FavoriteButton";
import { ShareBar } from "@/components/ui/ShareBar";

export default function NewsArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const article = resolveNews(id) ?? news[0];
  const related = article.related.map((r) => newsById.get(r)).filter(Boolean);
  usePageMeta({
    title: article.title,
    description: article.aiSummary[0] ?? article.title,
    path: newsPath(article),
    type: "article",
    jsonLd: articleJsonLd({
      headline: article.title,
      description: article.aiSummary[0] ?? article.title,
      path: newsPath(article),
      publishedAt: new Date(Date.now() - article.minutesAgo * 60_000).toISOString(),
    }),
    breadcrumbs: [
      { name: "News", path: "/news" },
      { name: article.category, path: newsPath(article) },
    ],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden /> Back
        </button>
        <div className="flex items-center gap-2">
          <BookmarkButton entry={{ kind: "news", refId: article.id, title: article.title, path: newsPath(article) }} />
          <ShareBar title={article.title} path={newsPath(article)} kind={article.category} />
        </div>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={article.category === "Rumour" ? "warn" : "accent"}>{article.category}</Badge>
          <Reliability score={article.reliability} />
          <span className="font-mono text-[11px] text-ink-3">
            {article.source} · {agoFromMinutes(article.minutesAgo)}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-ink md:text-[1.8rem]">{article.title}</h1>
      </header>

      <IQInsight title={`Read it in ${article.readSeconds} seconds`} feedback="News TL;DR">
        <ul className="space-y-1.5">
          {article.aiSummary.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-iq" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      </IQInsight>

      <article className="space-y-4 text-[15px] leading-[1.75] text-ink-2">
        {article.body.map((p, i) => (
          <p key={i} className={i === 0 ? "text-ink" : undefined}>
            {p}
          </p>
        ))}
      </article>

      {/* entities */}
      <div className="flex flex-wrap items-center gap-2 border-y border-line py-4">
        <span className="eyebrow mr-1">In this story</span>
        {article.teamIds.map((t) => (
          <Link key={t} to={`/team/${t}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink">
            <Crest teamId={t} size={16} /> {getTeam(t).short}
          </Link>
        ))}
        {article.playerIds.map((p) => (
          <Link key={p} to={`/player/${p}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink">
            <Avatar name={getPlayer(p).name} playerId={p} size={16} /> {getPlayer(p).name}
          </Link>
        ))}
      </div>

      {/* update timeline */}
      <section aria-label="Story updates">
        <p className="eyebrow mb-3">Story timeline</p>
        <ol className="relative space-y-3 before:absolute before:bottom-1 before:left-[0.34rem] before:top-1 before:w-px before:bg-line">
          {article.updates.map((u, i) => (
            <li key={i} className="relative flex gap-3 pl-0">
              <span className="z-10 mt-1 size-3 shrink-0 rounded-full border-2 border-accent bg-bg" aria-hidden />
              <div>
                <span className="font-mono text-[11px] text-accent-ink">{u.time}</span>
                <p className="text-[13px] text-ink-2">{u.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* related */}
      {related.length > 0 && (
        <section aria-label="Related stories">
          <p className="eyebrow mb-3">Related stories</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map(
              (r) =>
                r && (
                  <Card hover key={r.id} onClick={() => navigate(`/news/${r.id}`)} className="p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{r.category}</Badge>
                      <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-ink-3">
                        <Clock className="size-3" aria-hidden />
                        {r.readSeconds}s
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{r.title}</p>
                  </Card>
                ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
