import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Radio, Sparkles } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge, FormPills } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Avatar } from "@/components/ui/Avatar";
import { MatchCard } from "@/components/ui/MatchCard";
import { DataState } from "@/components/ui/DataState";
import { IQInsight } from "@/components/ui/IQInsight";
import { WaitlistForm } from "@/components/ui/Waitlist";
import { PersonalRows } from "@/components/ui/PersonalRows";
import { MomentumRiver } from "@/components/charts/MomentumRiver";
import { matchDetail, useMatchesState } from "@/lib/repositories/matches";
import { useHeadlinesState } from "@/lib/repositories/headlines";
import { HeadlineCard } from "@/components/ui/HeadlineCard";
import { getTeam, leagueTable } from "@/lib/repositories/teams";
import { usePlayersState } from "@/lib/repositories/players";
import { playerPathFor } from "@/lib/slug-builders";
import { cn } from "@/lib/utils";
import { kickoffLabel, kickoffTime } from "@/lib/kickoff";
import { usePageMeta } from "@/lib/seo";
import { legalEntries } from "@/lib/nav";

export default function Home() {
  usePageMeta({
    title: "AI Football Intelligence",
    description:
      "FootIQ is the AI intelligence layer for football — live match reads, outcome predictions and natural-language scouting on real Premier League data, algorithmically generated and clearly marked apart from verified fact.",
    path: "/",
  });
  const { data: matchData, status: matchStatus } = useMatchesState();
  /**
   * The hero features whatever is actually most relevant: a live match if one
   * is being played, otherwise the next scheduled fixture, otherwise nothing.
   *
   * This used to be `matchDetail("ars-liv")` — a hardcoded demo fixture, frozen
   * at 2-1 with a ticking 67th minute. It rendered as the site's headline
   * regardless of the real football calendar, which is the single most visible
   * thing this chunk exists to kill.
   */
  const featuredMatch = matchData.live[0] ?? matchData.upcoming[0] ?? null;
  const featured = featuredMatch ? matchDetail(featuredMatch.id) : null;
  const featuredLive = featured?.status === "live";
  const home = featured ? getTeam(featured.homeId) : null;
  const away = featured ? getTeam(featured.awayId) : null;
  const navigate = useNavigate();
  const headlineState = useHeadlinesState();
  const { data: allPlayers, status: playerStatus } = usePlayersState();
  const formLeaders = useMemo(
    () => allPlayers.filter((p) => p.stats.minutes > 0).sort((a, b) => b.fantasy.form - a.fantasy.form).slice(0, 4),
    [allPlayers],
  );
  const tickerItems = headlineState.data.slice(0, 10);
  const transferHeadlines = headlineState.data.filter((h) => h.category === "Transfers");

  return (
    <div className="space-y-10">
      {/* masthead: what FootIQ is, before any score */}
      <section aria-label="FootIQ introduction">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="eyebrow mb-1.5 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-iq-ink" aria-hidden />
              The AI intelligence layer for football · Beta
            </p>
            <h1 className="display text-2xl font-black leading-tight text-ink md:text-3xl">
              Not the scores. <span className="text-accent-ink">The reasons.</span>
            </h1>
            <p className="mt-1.5 max-w-2xl text-ui leading-relaxed text-ink-2">
              Every match and player on FootIQ carries a model's read on <em>why</em> — predictions, scouting and tactics in
              plain language. <span className="text-accent-ink">Emerald is measured fact</span>,{" "}
              <span className="text-iq-ink">amber is AI inference</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/predictions"
              className="inline-flex items-center gap-1.5 rounded-full border border-iq/35 bg-iq-soft px-4 py-2 text-caption font-semibold text-iq-ink transition-colors hover:border-iq/60"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Explore predictions
            </Link>
            <Link
              to="/scout"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-caption font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Try AI Scout
            </Link>
          </div>
        </div>
      </section>

      {/* ticker */}
      <div className="no-scrollbar -mx-4 overflow-hidden border-b border-line pb-3 md:-mx-6" aria-label="Breaking headlines">
        <div className="animate-ticker flex w-max gap-8 px-4">
          {tickerItems.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex shrink-0 items-center gap-2 text-caption text-ink-3 hover:text-ink"
            >
              <span className="size-1 rounded-full bg-accent" aria-hidden />
              <span className="font-mono text-micro uppercase tracking-wider text-ink-3">{n.source}</span>
              <span className="max-w-[26rem] truncate group-hover:underline">{n.title}</span>
            </a>
          ))}
          {/* second copy purely for the seamless marquee loop */}
          <div className="flex shrink-0 gap-8" aria-hidden>
            {tickerItems.map((n) => (
              <span key={`dup-${n.id}`} className="flex shrink-0 items-center gap-2 text-caption text-ink-3">
                <span className="size-1 rounded-full bg-accent" />
                <span className="font-mono text-micro uppercase tracking-wider text-ink-3">{n.source}</span>
                <span className="max-w-[26rem] truncate">{n.title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* personalization — invisible until the user follows/browses something */}
      <PersonalRows />

      {/* hero: the most relevant real match — live now, or up next */}
      {featured && home && away && (
        <section aria-label={featuredLive ? "Featured live match" : "Next fixture"}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="floodlight card relative overflow-hidden p-5 md:p-8"
          >
            <div className="flex flex-wrap items-center gap-2">
              {featuredLive ? <Badge variant="live">{featured.minute == null ? "Live" : `Live · ${featured.minute}'`}</Badge> : <Badge>{kickoffLabel(featured.kickoffIso)}</Badge>}
              <span className="font-mono text-label uppercase tracking-wider text-ink-3">{featured.competition} · {featured.venue}</span>
              {featured.headline && <span className="ml-auto hidden font-mono text-label text-ink-3 md:block">{featured.headline}</span>}
            </div>

            <div className="mt-6 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
              <TeamSide team={home} align="right" />
              <div className="order-first text-center lg:order-none">
                {featuredLive ? (
                  <p className="display select-none text-6xl font-black leading-none text-ink md:text-7xl">
                    {featured.homeScore}
                    <span className="mx-3 text-ink-3">–</span>
                    {featured.awayScore}
                  </p>
                ) : (
                  // No score exists before kickoff. Show the time it starts.
                  <p className="display select-none text-4xl font-black leading-none text-ink md:text-5xl">
                    {kickoffTime(featured.kickoffIso)}
                  </p>
                )}
                <button
                  onClick={() => navigate(`/match/${featured.id}`)}
                  className="group mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-ui font-semibold text-[#04110c] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  <Radio className="size-4" aria-hidden />
                  Open Match Center
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </div>
              <TeamSide team={away} align="left" />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              {/* Momentum is a read of play that has happened. An unplayed
                  fixture has none, so the chart is omitted rather than
                  generated from nothing. */}
              {featuredLive && (
                <div>
                  <p className="eyebrow mb-2">Momentum</p>
                  <MomentumRiver data={featured.momentum} homeLabel={home.short} awayLabel={away.short} height={120} />
                </div>
              )}
              {featured.aiCommentary.length > 0 && (
                <IQInsight compact title={featuredLive ? "Live IQ read" : "Fixture preview"}>
                  {featured.aiCommentary[featured.aiCommentary.length - 1].text}
                </IQInsight>
              )}
            </div>
          </motion.div>
        </section>
      )}

      {/* live now */}
      <section aria-label="Live matches">
        <SectionHeader title="Live Matches" action={<SeeAll to="/matches" />} />
        {matchData.live.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matchData.live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
        <DataState
          status={matchStatus}
          empty={matchData.live.length === 0}
          emptyTitle="No live matches"
          emptyBody={
            matchStatus === "ready" && matchData.upcoming.length > 0
              ? "Nothing is being played right now. The next scheduled fixtures are below."
              : "Nothing is being played right now."
          }
        />
      </section>

      <div className="grid gap-10 xl:grid-cols-[1.9fr_1fr] xl:gap-8">
        <div className="min-w-0 space-y-10">
          {/* breaking news */}
          <section aria-label="Breaking news">
            <SectionHeader eyebrow="BBC Sport · The Guardian · Sky Sports" title="Latest News" action={<SeeAll to="/news" />} />
            {headlineState.status !== "ready" || headlineState.data.length === 0 ? (
              <DataState
                status={headlineState.status}
                empty={headlineState.data.length === 0}
                loadingLabel="Loading headlines…"
                emptyTitle="No headlines right now"
                emptyBody="The news feeds will refresh shortly."
              />
            ) : (
              <div className="space-y-3">
                {headlineState.data.slice(0, 4).map((h) => (
                  <HeadlineCard key={h.id} h={h} />
                ))}
              </div>
            )}
          </section>

          {/* trending transfers */}
          <section aria-label="Trending transfers">
            <SectionHeader title="Transfer News" action={<SeeAll to="/transfers" />} />
            {transferHeadlines.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {transferHeadlines.slice(0, 4).map((h) => (
                  <HeadlineCard key={h.id} h={h} compact />
                ))}
              </div>
            ) : (
              <p className="text-caption text-ink-3">
                {headlineState.status === "loading" ? "Loading transfer news…" : "No transfer stories in the latest headlines."}
              </p>
            )}
          </section>
        </div>

        {/* right rail */}
        <div className="min-w-0 space-y-10">
          <section aria-label="League table">
            <SectionHeader eyebrow={leagueTable[0]?.league ?? "League"} title="Table" />
            <Card className="overflow-hidden">
              <table className="w-full text-ui">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-micro uppercase tracking-wider text-ink-3">
                    <th scope="col" className="py-2.5 pl-4 font-medium">#</th>
                    <th scope="col" className="font-medium">Club</th>
                    <th scope="col" className="text-right font-medium">GD</th>
                    <th scope="col" className="pr-4 text-right font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueTable.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/team/${t.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/team/${t.id}`);
                        }
                      }}
                      aria-label={`${t.short} team page`}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                    >
                      <td className={cn("py-2.5 pl-4 font-mono text-xs", t.position <= 4 ? "text-accent-ink" : "text-ink-3")}>{t.position}</td>
                      <td>
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <Crest teamId={t.id} size={20} />
                          {t.short}
                        </span>
                      </td>
                      <td className="tabular text-right font-mono text-xs text-ink-2">{t.gf - t.ga > 0 ? "+" : ""}{t.gf - t.ga}</td>
                      <td className="tabular py-2.5 pr-4 text-right font-mono text-ui font-bold text-ink">{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section aria-label="Upcoming fixtures">
            <SectionHeader title="Fixtures" action={<SeeAll to="/schedule" />} />
            {matchData.upcoming.length > 0 && (
              <div className="space-y-2.5">
                {matchData.upcoming.slice(0, 4).map((m) => (
                  <MatchCard key={m.id} match={m} dense />
                ))}
              </div>
            )}
            <DataState
              status={matchStatus}
              empty={matchData.upcoming.length === 0}
              emptyTitle="No upcoming fixtures"
              emptyBody="Nothing scheduled in the window we sync for the competitions we follow."
            />
          </section>

          <section aria-label="Fan sentiment">
            <SectionHeader title="Fan Pulse" />
            <Card className="p-4">
              <p className="text-ui font-semibold text-ink">Who wins the title from here?</p>
              <div className="mt-3 space-y-2.5">
                {[
                  { team: "ars", pct: 44 },
                  { team: "liv", pct: 31 },
                  { team: "mci", pct: 25 },
                ].map(({ team, pct }) => (
                  <div key={team} className="flex items-center gap-2.5">
                    <Crest teamId={team} size={20} />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-chart-2"
                      />
                    </div>
                    <span className="tabular w-9 text-right font-mono text-xs font-semibold text-ink">{pct}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-line pt-2.5 font-mono text-micro text-ink-3">128,441 votes · updated live</p>
            </Card>
          </section>

          <section aria-label="Form watch">
            <SectionHeader eyebrow="FPL form · last 30 days" title="Form Watch" action={<SeeAll to="/fantasy" />} />
            <Card className="divide-y divide-line">
              {formLeaders.length === 0 ? (
                <DataState status={playerStatus} empty loadingLabel="Loading players…" emptyTitle="No form data yet" emptyBody="Player form syncs hourly from the FPL feed." />
              ) : (
                formLeaders.map((p) => (
                  <Link key={p.id} to={playerPathFor(p)} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2">
                    <Avatar name={p.name} photoUrl={p.photoUrl} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ui font-semibold text-ink">{p.name}</p>
                      <p className="text-label text-ink-3">
                        {getTeam(p.teamId).short} · {p.stats.goals}G {p.stats.assists}A
                      </p>
                    </div>
                    <span className="tabular font-mono text-ui font-semibold text-accent-ink">{p.fantasy.form.toFixed(1)}</span>
                  </Link>
                ))
              )}
            </Card>
          </section>
        </div>
      </div>

      {/* waitlist */}
      <section aria-label="Join the waitlist">
        <div className="floodlight card relative overflow-hidden p-6 md:p-10">
          <div className="mx-auto max-w-xl text-center">
            <p className="eyebrow mb-2">Public beta · Live data coming</p>
            <h2 className="display text-2xl font-black text-ink md:text-3xl">Be first when the real feeds switch on</h2>
            <p className="mt-2.5 text-body leading-relaxed text-ink-2">
              The beta runs on demo data so you can explore everything today. Join the waitlist and we'll email you exactly once — when
              live matches, live models and live probabilities arrive.
            </p>
            <WaitlistForm className="mx-auto mt-5 max-w-md text-left" />
            <p className="mt-3 font-mono text-micro uppercase tracking-wider text-ink-3">No spam · one email · stored on your device during beta</p>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line pt-6" aria-label="Site footer">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalEntries.map((l) => (
              <Link key={l.to} to={l.to} className="font-mono text-micro uppercase tracking-wider text-ink-3 transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="max-w-2xl text-label leading-relaxed text-ink-3">
            FootIQ is a demo platform in public beta. Insights are algorithmically generated, predictions are informational only — never betting advice —
            and statistics may be simulated. © 2026 FootIQ.
          </p>
        </div>
      </footer>
    </div>
  );
}

function TeamSide({ team, align }: { team: ReturnType<typeof getTeam>; align: "left" | "right" }) {
  return (
    <Link
      to={`/team/${team.id}`}
      className={cn("group flex items-center gap-4", align === "right" ? "lg:flex-row-reverse lg:text-right" : "")}
    >
      <Crest teamId={team.id} size={64} className="transition-transform group-hover:scale-105" />
      <div>
        <p className="display text-xl font-bold text-ink md:text-2xl">{team.short}</p>
        <div className={cn("mt-1.5 flex items-center gap-2", align === "right" && "lg:justify-end")}>
          <FormPills form={team.form} />
        </div>
        <p className="mt-1 font-mono text-label text-ink-3">{team.manager}</p>
      </div>
    </Link>
  );
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1 font-mono text-label uppercase tracking-wider text-accent-ink hover:underline">
      See all
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
