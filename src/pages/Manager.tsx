import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge, FormPills } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Crest } from "@/components/ui/Crest";
import { IQInsight } from "@/components/ui/IQInsight";
import { ShareBar } from "@/components/ui/ShareBar";
import { playersOf, usePlayers } from "@/lib/repositories/players";
import { managerPath, managerSlug, playerPath, resolveManager, teamPath } from "@/lib/slugs";
import { personJsonLd, usePageMeta } from "@/lib/seo";

const DIALS: Array<{ key: "tempo" | "width" | "directness" | "pressIntensity"; label: string }> = [
  { key: "tempo", label: "Tempo" },
  { key: "width", label: "Width" },
  { key: "directness", label: "Directness" },
  { key: "pressIntensity", label: "Press intensity" },
];

export default function Manager() {
  const { slug } = useParams();
  usePlayers(); // re-render when players arrive from the API
  const team = resolveManager(slug);

  usePageMeta(
    team
      ? {
          title: `${team.manager} — Tactical Style & System`,
          description: `${team.manager}'s game model at ${team.name}: formation, build-up, pressing scheme and the four dials that define the system.`,
          path: managerPath(team),
          jsonLd: personJsonLd(
            { name: team.manager, role: "Manager" },
            { teamName: team.name, path: managerPath(team) },
          ),
          breadcrumbs: [
            { name: "Teams", path: "/matches" },
            { name: team.manager, path: managerPath(team) },
          ],
        }
      : { title: "Managers" },
  );

  if (!team) return <Navigate to="/" replace />;

  const squad = playersOf(team.id).sort((a, b) => b.stats.minutes - a.stats.minutes).slice(0, 4);
  const s = team.style;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        trail={[
          { name: team.name, path: teamPath(team) },
          { name: team.manager, path: managerPath(team) },
        ]}
      />

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Crest teamId={team.id} size={52} />
            <div>
              <p className="eyebrow mb-0.5">Manager · {team.name}</p>
              <SectionHeader level={1} title={team.manager} className="mb-0" />
              <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-2">
                <Badge variant="accent">{s.formation}</Badge>
                <span>{team.league}</span> · <span>{team.position}ᵗʰ, {team.points} pts</span>
                <FormPills form={team.form} />
              </p>
            </div>
          </div>
          <ShareBar title={`${team.manager} — Tactical DNA`} path={managerPath(team)} kind="Manager DNA" stat={s.formation} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Four dials" />
          <div className="space-y-4">
            {DIALS.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex items-center justify-between font-mono text-micro uppercase tracking-wider">
                  <span className="text-ink-3">{d.label}</span>
                  <span className="text-ink">{s[d.key]}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${s[d.key]}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 text-ui text-ink-2 sm:grid-cols-3">
            <div><p className="eyebrow mb-0.5">Build-up</p>{s.buildUp}</div>
            <div><p className="eyebrow mb-0.5">Press</p>{s.press}</div>
            <div><p className="eyebrow mb-0.5">Line</p>{s.line}</div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Style signature" />
          <div className="mb-4 flex flex-wrap gap-1.5">
            {team.styleTags.map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
          <IQInsight title="FootIQ tactical read" compact>
            {team.aiReport[0]}
          </IQInsight>
          <Link
            to={`/intelligence/manager-${managerSlug(team)}`}
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-wider text-accent-ink transition-colors hover:text-ink"
          >
            <Sparkles className="size-3.5" aria-hidden /> Full tactical DNA report <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader title="Most-used players" action={
          <Link to={teamPath(team)} className="font-mono text-label uppercase tracking-wider text-ink-3 transition-colors hover:text-ink">
            Full squad <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        } />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {squad.map((p) => (
            <Link key={p.id} to={playerPath(p)} className="group">
              <Card hover className="p-4">
                <p className="display text-body font-bold text-ink transition-colors group-hover:text-accent-ink">{p.name}</p>
                <p className="mt-0.5 text-label text-ink-3">{p.role} · {p.stats.minutes} min</p>
              </Card>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
