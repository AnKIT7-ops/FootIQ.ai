import { Mail, MessageSquareText, Bug, Handshake } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProsePage, ProseSection } from "@/components/ui/Prose";
import { WaitlistForm } from "@/components/ui/Waitlist";
import { FeedbackForm } from "@/components/ui/FeedbackWidget";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";

const CONTACT_EMAIL = "hello@footiq.ai";

const channels = [
  {
    icon: MessageSquareText,
    title: "Product feedback",
    body: "What's confusing, what's missing, what you'd pay for. Beta feedback directly shapes the roadmap.",
  },
  {
    icon: Bug,
    title: "Bug reports",
    body: "Broken layout, wrong number, dead link — include your device and browser and we'll chase it down.",
  },
  {
    icon: Handshake,
    title: "Partnerships & press",
    body: "Data providers, clubs, creators and writers — tell us what you're building and where FootIQ fits.",
  },
];

export default function Contact() {
  usePageMeta(staticPageMeta["/contact"]);

  return (
    <ProsePage eyebrow="Talk to the team" title="Contact">
      <Card className="floodlight p-5 md:p-6">
        <p className="eyebrow mb-1.5">One inbox for everything</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2.5 text-lg font-bold text-ink underline-offset-4 hover:underline md:text-xl"
        >
          <Mail className="size-5 text-accent-ink" aria-hidden />
          {CONTACT_EMAIL}
        </a>
        <p className="mt-2 text-ui leading-relaxed text-ink-2">
          We read everything. During the beta, replies typically land within a few days.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {channels.map((c) => (
          <Card key={c.title} className="p-4">
            <c.icon className="size-4.5 text-accent-ink" aria-hidden />
            <h2 className="mt-2 text-body font-bold text-ink">{c.title}</h2>
            <p className="mt-1 text-caption leading-relaxed text-ink-2">{c.body}</p>
          </Card>
        ))}
      </div>

      <ProseSection title="Send it right here">
        <p>Fastest path during the beta — lands straight in the product queue, no inbox detour.</p>
        <FeedbackForm className="mt-3 max-w-lg" />
      </ProseSection>

      <ProseSection title="Want the briefing instead?">
        <p>Join the newsletter for weekly AI football intelligence and product updates.</p>
        <WaitlistForm className="mt-3 max-w-lg" />
      </ProseSection>
    </ProsePage>
  );
}
