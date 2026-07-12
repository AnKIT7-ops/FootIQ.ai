import { Link } from "react-router-dom";
import { ProsePage, ProseSection, ProseList } from "@/components/ui/Prose";
import { usePageMeta } from "@/lib/seo";

export default function Privacy() {
  usePageMeta({
    title: "Privacy Policy",
    description: "How FootIQ handles data during the beta: local-first storage, no accounts, optional privacy-respecting analytics.",
    path: "/privacy",
  });

  return (
    <ProsePage eyebrow="Local-first by design" title="Privacy Policy" updated="July 10, 2026">
      <ProseSection title="The short version">
        <p>
          The FootIQ beta has <strong className="text-ink">no accounts and no server-side database</strong>. Your preferences never leave
          your device. If analytics are enabled on a deployment, they are aggregate and anonymous.
        </p>
      </ProseSection>

      <ProseSection title="1. Data stored on your device">
        <p>FootIQ keeps a small amount of data in your browser's local storage so the product remembers you between visits:</p>
        <ProseList
          items={[
            "Theme choice (dark or light).",
            "Favorite teams, followed players and alert preferences from your Profile.",
            "Waitlist email, if you join the waitlist during the beta.",
          ]}
        />
        <p>
          This data stays in your browser. It is not transmitted to FootIQ. Clearing your browser's site data removes it completely.
        </p>
      </ProseSection>

      <ProseSection title="2. Analytics (optional)">
        <p>
          Deployments of FootIQ may enable Google Analytics 4 and/or Microsoft Clarity to understand aggregate usage — pages visited,
          approximate region, device class. When enabled these tools may set cookies; when not configured, no analytics code loads at all.
          We never sell data, and we collect no names, emails or payment details through analytics.
        </p>
      </ProseSection>

      <ProseSection title="3. Third-party content">
        <p>
          Club crests, player portraits and national flags load from public content delivery networks (FotMob and flagcdn). Your browser
          requests those images directly, which exposes your IP address to those CDNs the same way any image on the web does. Their own
          privacy policies apply to those requests.
        </p>
      </ProseSection>

      <ProseSection title="4. Your choices">
        <ProseList
          items={[
            "Use the site without joining the waitlist — every feature works either way.",
            "Block analytics with any standard content blocker; the product functions identically.",
            "Clear site data at any time to reset FootIQ to a fresh state.",
          ]}
        />
      </ProseSection>

      <ProseSection title="5. Changes and contact">
        <p>
          When live data, accounts or a backend arrive, this policy will be updated before those features ship. Questions about privacy —{" "}
          <Link to="/contact" className="text-accent-ink underline underline-offset-2 hover:text-ink">contact us</Link>.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
