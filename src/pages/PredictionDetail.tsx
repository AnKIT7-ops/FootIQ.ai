import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { recordPredictionView } from "@/lib/user";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Crest } from "@/components/ui/Crest";
import { AIMeta } from "@/components/ui/AIMeta";
import { ShareBar } from "@/components/ui/ShareBar";
import { getTeam } from "@/lib/repositories/teams";
import { predictionByMatch } from "@/lib/repositories/predictions";
import { matchPath, matchSlug, predictionPath, resolveMatch, teamPath } from "@/lib/slugs";
import { usePageMeta } from "@/lib/seo";
import { weekStamp } from "@/lib/repositories/content";
import { useMatchesState } from "@/lib/repositories/matches";
import { DataState } from "@/components/ui/DataState";

function Bar({ label, value, tone }: { label: string; value: number; tone: "home" | "draw" | "away" }) {
  const color = tone === "home" ? "bg-accent" : tone === "away" ? "bg-chart-2" : "bg-surface-3";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-micro uppercase tracking-wider">
        <span className="text-ink-3">{label}</span>
        <span className="text-ink">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3/60">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function PredictionDetail() {
  const { slug } = useParams();
  // Resolution depends on the fixtures AND the live/demo answer that rides on
  // them: re-render when they land, and don't redirect before they have.
  const { status } = useMatchesState();
  const match = resolveMatch(slug);
  const pred = match ? predictionByMatch.get(match.id) : undefined;
  const home = match ? getTeam(match.homeId) : null;
  const away = match ? getTeam(match.awayId) : null;

  usePageMeta(
    match && pred && home && away
      ? {
          title: `${home.name} vs ${away.name} Prediction — AI Probabilities`,
          description: `AI match prediction for ${home.name} vs ${away.name}: ${pred.homeWin}% home, ${pred.draw}% draw, ${pred.awayWin}% away, expected ${pred.expectedHome.toFixed(1)}–${pred.expectedAway.toFixed(1)} — with the model's reasoning.`,
          path: predictionPath(match),
          // Demo fixture + demo numbers: never indexed, no SportsEvent structured data.
          noIndex: true,
          breadcrumbs: [
            { name: "Predictions", path: "/predictions" },
            { name: `${home.short} vs ${away.short}`, path: predictionPath(match) },
          ],
        }
      : { title: "Prediction not found", noIndex: true },
  );

  useEffect(() => {
    if (match && pred && home && away) {
      recordPredictionView({
        matchId: match.id,
        path: predictionPath(match),
        label: `${home.short} vs ${away.short}`,
        probs: [pred.homeWin, pred.draw, pred.awayWin],
      });
    }
  }, [match, pred, home, away]);

  if (!match && status === "loading") return <DataState status={status} empty={false} emptyTitle="" emptyBody="" />;
  // Real fixtures have no demo report — send them to the live forecast for that match.
  if (match && !pred) return <Navigate to={`/predictions?match=${encodeURIComponent(match.id)}`} replace />;
  if (!match || !pred || !home || !away) return <Navigate to="/predictions" replace />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        trail={[
          { name: "Predictions", path: "/predictions" },
          { name: `${home.short} vs ${away.short}`, path: predictionPath(match) },
        ]}
      />

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <Crest teamId={home.id} size={40} />
          <SectionHeader level={1} title={`${home.short} vs ${away.short}`} className="mb-0" />
          <Crest teamId={away.id} size={40} />
        </div>
        <p className="mb-5 font-mono text-label uppercase tracking-wider text-ink-3">
          {match.competition} · {match.venue} · expected {pred.expectedHome.toFixed(1)}–{pred.expectedAway.toFixed(1)}
        </p>
        <div className="space-y-3">
          <Bar label={`${home.name} win`} value={pred.homeWin} tone="home" />
          <Bar label="Draw" value={pred.draw} tone="draw" />
          <Bar label={`${away.name} win`} value={pred.awayWin} tone="away" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pred.topScores.slice(0, 2).map((s) => (
            <div key={s.score} className="rounded-xl bg-surface-2 p-3 text-center">
              <p className="font-mono text-lg font-bold text-ink">{s.score}</p>
              <p className="font-mono text-micro uppercase tracking-wider text-ink-3">{s.p}% likely</p>
            </div>
          ))}
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="font-mono text-lg font-bold text-ink">{pred.over25}%</p>
            <p className="font-mono text-micro uppercase tracking-wider text-ink-3">Over 2.5</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="font-mono text-lg font-bold text-ink">{pred.btts}%</p>
            <p className="font-mono text-micro uppercase tracking-wider text-ink-3">BTTS</p>
          </div>
        </div>
      </Card>

      <ShareBar
        title={`${home.short} vs ${away.short} — AI Prediction`}
        path={predictionPath(match)}
        kind="AI Prediction"
        stat={`${pred.homeWin}% / ${pred.draw}% / ${pred.awayWin}%`}
      />

      <Card className="p-5">
        <SectionHeader title="The model's reasoning" />
        <ul className="space-y-2.5">
          {pred.reasoning.map((r, i) => (
            <li key={i} className="flex gap-2 text-ui leading-relaxed text-ink-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-iq" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      </Card>

      <AIMeta
        generatedAt={weekStamp()}
        sources={[
          { label: `${home.name} team page`, path: teamPath(home) },
          { label: `${away.name} team page`, path: teamPath(away) },
          { label: "Match center", path: matchPath(match) },
          // preview articles are generated for matches still to play
          ...(match.status !== "finished" ? [{ label: "AI match preview", path: `/intelligence/preview-${matchSlug(match)}` }] : []),
        ]}
      />

      <Link
        to={matchPath(match)}
        className="inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-wider text-accent-ink transition-colors hover:text-ink"
      >
        Open match center <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
