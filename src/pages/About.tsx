import { Link } from "react-router-dom";
import { Sparkles, Radar, GitCompareArrows, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { IQInsight } from "@/components/ui/IQInsight";
import { ProsePage, ProseSection } from "@/components/ui/Prose";
import { usePageMeta } from "@/lib/seo";

const pillars = [
  {
    icon: Sparkles,
    title: "Predictions",
    body: "Outcome probabilities and expected scorelines for every fixture — with the reasoning shown, never hidden.",
  },
  {
    icon: Radar,
    title: "AI Scout",
    body: "Describe a player in plain language and get Premier League players ranked on their real per-90 output.",
  },
  {
    icon: GitCompareArrows,
    title: "Comparison engine",
    body: "Players, teams and managers side by side — per-90 percentile radars and season totals from real data.",
  },
  {
    icon: ClipboardList,
    title: "Tactical intelligence",
    body: "A live tactical board that reads your shape as you drag — line height, compactness, width and the matchup consequences.",
  },
];

export default function About() {
  usePageMeta({
    title: "About",
    description: "FootIQ is the AI intelligence layer for football — what it is, how the amber/emerald honesty system works, and where the beta is heading.",
    path: "/about",
  });

  return (
    <ProsePage eyebrow="The AI intelligence layer for football" title="About FootIQ">
      <ProseSection title="What FootIQ is">
        <p>
          FootIQ is not a live-score app. Scores tell you <em>what</em> happened; FootIQ is built to tell you <em>why</em> it happened and{" "}
          <em>what is likely to happen next</em>. Every surface — match center, news desk, transfer market, fantasy assistant — carries an
          AI reasoning layer on top of the raw numbers.
        </p>
        <p>
          The product is currently in <strong className="text-ink">public beta</strong>. League standings and fixtures sync from live
          football data (Premier League via{" "}
          <a href="https://www.football-data.org" target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
            football-data.org
          </a>
          ), and Premier League players from the official Fantasy Premier League API. A few features still use illustrative data and say so where they appear.
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("footiq:tour"))}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-caption font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          Take the 30-second tour
        </button>
      </ProseSection>

      <div className="grid gap-3 sm:grid-cols-2">
        {pillars.map((p) => (
          <Card key={p.title} className="p-4 md:p-5">
            <p.icon className="size-5 text-accent-ink" aria-hidden />
            <h2 className="display mt-2.5 text-base font-bold text-ink">{p.title}</h2>
            <p className="mt-1.5 text-ui leading-relaxed text-ink-2">{p.body}</p>
          </Card>
        ))}
      </div>

      <ProseSection title="The honesty system">
        <p>
          Football analytics has a trust problem: models presented as facts. FootIQ's answer is a strict two-color rule that runs through
          the entire interface:
        </p>
        <p>
          <span className="font-semibold text-accent-ink">Emerald</span> marks measured fact — scores, minutes, distances, results.{" "}
          <span className="font-semibold text-iq-ink">Amber</span> marks model inference — predictions, fit scores, similarity ratings,
          tactical reads. If it glows amber, it's inference, not fact — and it can be wrong. A 70% favourite still loses three times in ten.
        </p>
      </ProseSection>

      <IQInsight title="Why this exists">
        Clubs pay analysts for the layer between data and decision. FootIQ's bet is that every fan deserves that layer — explained in
        plain language, honest about uncertainty, and fast enough to follow the game in real time.
      </IQInsight>

      <ProseSection title="Get in touch">
        <p>
          Questions, feedback or partnership ideas — see the <Link to="/contact" className="text-accent-ink underline underline-offset-2 hover:text-ink">contact page</Link>, and read the{" "}
          <Link to="/disclaimer" className="text-accent-ink underline underline-offset-2 hover:text-ink">beta disclaimer</Link> for what the demo data does and doesn't claim.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
