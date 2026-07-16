import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProsePage, ProseSection, ProseList } from "@/components/ui/Prose";
import { usePageMeta } from "@/lib/seo";

export default function Disclaimer() {
  usePageMeta({
    title: "Disclaimer",
    description: "FootIQ beta disclaimer: demo platform, AI-generated insights, informational predictions only — not betting advice.",
    path: "/disclaimer",
  });

  return (
    <ProsePage eyebrow="Read before you rely on anything" title="Disclaimer" updated="July 10, 2026">
      <Card className="flex gap-3 border-iq/30 bg-iq-soft p-4 md:p-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-iq-ink" aria-hidden />
        <p className="text-body leading-relaxed text-ink">
          FootIQ is a <strong>demonstration platform in public beta</strong>. Insights are <strong>AI-generated</strong>, predictions are{" "}
          <strong>informational only</strong>, and statistics <strong>may be simulated</strong>. Nothing on this site is betting, financial
          or professional advice.
        </p>
      </Card>

      <ProseSection title="1. Demo platform">
        <p>
          FootIQ is in public beta. League standings and fixtures sync from live football data (football-data.org) where available — the
          provenance chip in the top bar tells you which mode you're in. Everything else — player statistics, transfer probabilities,
          fantasy projections and news items — may be <strong className="text-ink">simulated, delayed or fictionalized</strong> for
          demonstration purposes, even where real player and club names appear.
        </p>
      </ProseSection>

      <ProseSection title="2. AI-generated content">
        <p>
          Content highlighted in amber — insights, predictions, tactical reads, similarity scores, scouting fit scores and the concierge
          assistant — is produced by <strong className="text-ink">automated models</strong>. Model output can be incomplete, outdated or
          simply wrong. It reflects statistical patterns, not verified editorial reporting.
        </p>
      </ProseSection>

      <ProseSection title="3. AI provenance">
        <p>
          Every substantial AI block carries a provenance strip instead of a confidence score: the date it was generated and links to the
          structured team, player and match pages the analysis was built from. FootIQ deliberately shows no confidence percentage — no model
          in the pipeline produces one, and a number nobody can trace back to real data is worse than no number at all. Treat every AI block
          as <strong className="text-ink">speculative analysis</strong>, not verified reporting.
        </p>
      </ProseSection>

      <ProseSection title="4. Predictions are informational only">
        <p>
          Match predictions are probability estimates for <strong className="text-ink">entertainment and analysis</strong>. A 70% favourite
          still loses three times out of ten. Predictions must not be treated as a promise, forecast guarantee or recommendation to act.
        </p>
      </ProseSection>

      <ProseSection title="5. Not betting advice">
        <ProseList
          items={[
            "FootIQ does not provide betting, gambling or wagering advice of any kind.",
            "Probabilities shown here are not odds and are not calibrated for wagering decisions.",
            "Never bet money based on information from this platform.",
            <>If gambling affects you or someone close to you, help is available — e.g. <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">BeGambleAware</a>.</>,
          ]}
        />
      </ProseSection>

      <ProseSection title="6. No affiliation">
        <p>
          FootIQ is not affiliated with, endorsed by or connected to any football club, league, federation or player featured in the demo.
          Club and player names appear for demonstration context only. Crests and portraits load from public CDNs and remain the property
          of their respective owners.
        </p>
      </ProseSection>

      <ProseSection title="7. No liability">
        <p>
          The platform is provided "as is" without warranties of any kind. To the maximum extent permitted by law, FootIQ accepts no
          liability for decisions made, or losses incurred, in reliance on any content shown here.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
