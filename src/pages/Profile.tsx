import { Link, useNavigate } from "react-router-dom";
import { BellRing, Bookmark, Crown, Eye, GitCompareArrows, Star, TrendingUp, UserRoundSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { IQInsight } from "@/components/ui/IQInsight";
import { useLocalStorage } from "@/lib/hooks";
import { teams, getTeam } from "@/lib/repositories/teams";
import { players } from "@/lib/repositories/players";
import { getPlayer } from "@/lib/repositories/players";
import { favoritesOf, setPref, toggleFavorite, toggleBookmark, useUserData, type NotificationPrefs } from "@/lib/user";
import { playerPath } from "@/lib/slugs";
import { cn, money } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";

const prefLabels: Record<keyof NotificationPrefs, string> = {
  matchReminders: "Match reminders for followed teams",
  aiReports: "New AI reports on your watchlist",
  transferUpdates: "Transfer probability moves ±10%",
  favoriteTeamNews: "Breaking news for followed teams",
  weeklyDigest: "Weekly AI digest by email",
};

const savedComparisons = [
  { a: "saka", b: "yamal", note: "Wing debate" },
  { a: "haaland", b: "isak", note: "No.9 market" },
];

export default function Profile() {
  usePageMeta({
    title: "Your Profile",
    description: "Favorite teams, followed players, saved reports, prediction history and notification preferences.",
    path: "/profile",
    noIndex: true,
  });
  const user = useUserData();
  const [premium, setPremium] = useLocalStorage("footiq-premium", true);
  const navigate = useNavigate();

  const favTeams = favoritesOf("team");
  const favPlayers = favoritesOf("player");

  return (
    <div className="space-y-8">
      {/* header */}
      <Card className="floodlight flex flex-wrap items-center gap-5 p-5 md:p-7">
        <Avatar name="Ankit L" size={72} ringColor="var(--accent)" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="display text-2xl font-black text-ink md:text-3xl">Ankit</h1>
            {premium && (
              <Badge variant="iq" className="px-2.5 py-1">
                <Crown className="size-3" aria-hidden /> IQ Premium
              </Badge>
            )}
          </div>
          <p className="mt-1 text-ui text-ink-2">
            {favTeams.length} teams · {favPlayers.length} players followed · {user.bookmarks.length} saved reports
          </p>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="tabular font-display text-2xl font-black text-ink">{user.predictionViews.length}</p>
            <p className="eyebrow">Predictions tracked</p>
          </div>
          <div>
            <p className="tabular font-display text-2xl font-black text-ink">{user.bookmarks.length}</p>
            <p className="eyebrow">Saved reports</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* favourite teams */}
        <section aria-label="Favorite teams">
          <SectionHeader title="Favorite Teams" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {teams.map((t) => {
              const active = favTeams.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleFavorite("team", t.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-colors",
                    active ? "border-accent/50 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                  )}
                  aria-pressed={active}
                >
                  <Crest teamId={t.id} size={28} />
                  <span className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">{t.short}</span>
                  <Star className={cn("size-4 shrink-0", active ? "fill-accent text-accent" : "text-ink-3")} aria-hidden />
                </button>
              );
            })}
          </div>
        </section>

        {/* followed players */}
        <section aria-label="Followed players">
          <SectionHeader title="Followed Players" />
          <Card className="divide-y divide-line">
            {players
              .filter((p) => favPlayers.includes(p.id))
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3.5">
                  <Avatar name={p.name} playerId={p.id} size={38} ringColor={getTeam(p.teamId).colors[0]} />
                  <button onClick={() => navigate(playerPath(p))} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-ui font-semibold text-ink hover:underline">{p.name}</p>
                    <p className="text-label text-ink-3">
                      {getTeam(p.teamId).short} · {p.role} · {money(p.marketValue)}
                    </p>
                  </button>
                  <button
                    onClick={() => toggleFavorite("player", p.id)}
                    className="rounded-full border border-line px-3 py-1 font-mono text-micro uppercase tracking-wider text-ink-3 transition-colors hover:border-bad/40 hover:text-bad"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            {favPlayers.length === 0 && (
              <EmptyState
                icon={UserRoundSearch}
                title="Your watchlist is empty"
                body="Follow players to get AI reports, transfer alerts and a personalized home feed. Popular right now:"
              >
                {[...players]
                  .sort((a, b) => b.form.slice(-3).reduce((x, y) => x + y, 0) - a.form.slice(-3).reduce((x, y) => x + y, 0))
                  .slice(0, 4)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleFavorite("player", p.id)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-accent/40 hover:text-ink"
                    >
                      + {p.name}
                    </button>
                  ))}
              </EmptyState>
            )}
          </Card>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {players
              .filter((p) => !favPlayers.includes(p.id))
              .slice(0, 6)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleFavorite("player", p.id)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-accent/40 hover:text-ink"
                >
                  + {p.name}
                </button>
              ))}
          </div>
        </section>

        {/* saved reports */}
        <section aria-label="Saved reports">
          <SectionHeader title="Bookmarked Reports" />
          <Card className="divide-y divide-line">
            {user.bookmarks.slice(0, 8).map((b) => (
              <div key={b.refId} className="flex items-center gap-3 p-3.5">
                <Bookmark className="size-4 shrink-0 fill-iq-ink text-iq-ink" aria-hidden />
                <Link to={b.path} className="min-w-0 flex-1">
                  <p className="truncate text-ui font-semibold text-ink hover:underline">{b.title}</p>
                  <p className="font-mono text-micro uppercase tracking-wider text-ink-3">
                    {b.kind === "intel" ? "Intelligence" : "News"} · {b.savedAt.slice(0, 10)}
                  </p>
                </Link>
                <button
                  onClick={() => toggleBookmark(b)}
                  className="rounded-full border border-line px-3 py-1 font-mono text-micro uppercase tracking-wider text-ink-3 transition-colors hover:border-bad/40 hover:text-bad"
                >
                  Remove
                </button>
              </div>
            ))}
            {user.bookmarks.length === 0 && (
              <EmptyState
                icon={Bookmark}
                title="Nothing saved for later"
                body="Bookmark any news story or Intelligence report and it waits for you here — and under Continue reading on the home page."
              >
                <Link to="/intelligence" className="rounded-full border border-iq/35 bg-iq-soft px-3 py-1.5 text-xs font-medium text-iq-ink transition-colors hover:border-iq/60">
                  Browse Intelligence reports
                </Link>
                <Link to="/news" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                  Latest news
                </Link>
              </EmptyState>
            )}
          </Card>
        </section>

        {/* prediction history */}
        <section aria-label="Prediction history">
          <SectionHeader title="Prediction History" />
          <Card className="divide-y divide-line">
            {user.predictionViews.slice(0, 8).map((v) => (
              <Link key={v.matchId} to={v.path} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2">
                <TrendingUp className="size-4 shrink-0 text-chart-2" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui font-semibold text-ink">{v.label}</p>
                  <p className="font-mono text-micro uppercase tracking-wider text-ink-3">viewed {v.viewedAt.slice(0, 10)}</p>
                </div>
                <span className="shrink-0 font-mono text-label text-ink-2">
                  {v.probs[0]}/{v.probs[1]}/{v.probs[2]}
                </span>
              </Link>
            ))}
            {user.predictionViews.length === 0 && (
              <EmptyState
                icon={TrendingUp}
                title="No predictions tracked yet"
                body="Open any match prediction and FootIQ logs the model's call here, so you can check it against what actually happened."
              >
                <Link to="/predictions" className="rounded-full border border-iq/35 bg-iq-soft px-3 py-1.5 text-xs font-medium text-iq-ink transition-colors hover:border-iq/60">
                  See this week's predictions
                </Link>
              </EmptyState>
            )}
          </Card>
        </section>

        {/* notification preferences */}
        <section aria-label="Notification preferences">
          <SectionHeader title="Notifications" />
          <Card className="divide-y divide-line">
            {(Object.keys(prefLabels) as Array<keyof NotificationPrefs>).map((key) => {
              const on = user.prefs[key];
              return (
                <div key={key} className="flex items-center gap-3 p-3.5">
                  <BellRing className={cn("size-4 shrink-0", on ? "text-accent-ink" : "text-ink-3")} aria-hidden />
                  <span className="min-w-0 flex-1 text-ui text-ink-2">{prefLabels[key]}</span>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={prefLabels[key]}
                    onClick={() => setPref(key, !on)}
                    className={cn("relative h-6 w-10.5 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-surface-3")}
                  >
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", on ? "left-5" : "left-0.5")} />
                  </button>
                </div>
              );
            })}
          </Card>
        </section>

        {/* saved comparisons + premium */}
        <section aria-label="Saved comparisons and premium">
          <SectionHeader title="Saved Comparisons" />
          <div className="space-y-2.5">
            {savedComparisons.map((s, i) => {
              const a = getPlayer(s.a);
              const b = getPlayer(s.b);
              return (
                <Card hover key={i} onClick={() => navigate("/compare")} className="flex items-center gap-3 p-3.5">
                  <GitCompareArrows className="size-4 shrink-0 text-chart-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui font-semibold text-ink">
                      {a.name} vs {b.name}
                    </p>
                    <p className="text-label text-ink-3">{s.note}</p>
                  </div>
                  <Bookmark className="size-4 shrink-0 fill-iq-ink text-iq-ink" aria-hidden />
                </Card>
              );
            })}
            <Card className="p-4">
              <p className="flex items-center gap-2 text-ui font-bold text-ink">
                <Crown className="size-4 text-iq-ink" aria-hidden /> IQ Premium
              </p>
              <ul className="mt-2.5 space-y-1.5 text-caption text-ink-2">
                <li className="flex gap-2"><Eye className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden /> Unlimited AI Scout queries & live win-probability feeds</li>
                <li className="flex gap-2"><Eye className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden /> Full historical model archive back to 1950</li>
                <li className="flex gap-2"><Eye className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden /> Fantasy chip optimizer with private projections</li>
              </ul>
              <button
                onClick={() => setPremium((p) => !p)}
                className={cn(
                  "mt-3.5 w-full rounded-xl py-2.5 text-ui font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]",
                  premium ? "border border-line text-ink-2" : "bg-iq text-[#241a02]",
                )}
              >
                {premium ? "Manage subscription" : "Upgrade to Premium"}
              </button>
            </Card>
          </div>
        </section>
      </div>

      <IQInsight title="Personalization note">
        Favorites, watchlists and alert choices tune every surface — notifications, the home feed and the concierge answer with your
        clubs first. Stored on this device; synced to your account when signed in on a configured deployment.
      </IQInsight>
    </div>
  );
}
