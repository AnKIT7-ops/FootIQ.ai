import { Link } from "react-router-dom";
import { ProsePage, ProseSection, ProseList } from "@/components/ui/Prose";
import { usePageMeta } from "@/lib/seo";
import { staticPageMeta } from "@/lib/page-meta";

export default function Terms() {
  usePageMeta(staticPageMeta["/terms"]);

  return (
    <ProsePage eyebrow="The rules of the pitch" title="Terms of Service" updated="July 10, 2026">
      <ProseSection title="1. Acceptance">
        <p>
          By using FootIQ (the "Service") you agree to these terms. If you do not agree, do not use the Service. The Service is currently a{" "}
          <strong className="text-ink">free public beta</strong> provided for evaluation and entertainment.
        </p>
      </ProseSection>

      <ProseSection title="2. The beta service">
        <ProseList
          items={[
            "The Service may change, break or be withdrawn at any time without notice.",
            "Data shown may be simulated or fictionalized — see the Disclaimer.",
            "No uptime, accuracy or support commitments are made during the beta.",
          ]}
        />
      </ProseSection>

      <ProseSection title="3. Acceptable use">
        <p>You agree not to:</p>
        <ProseList
          items={[
            "Use the Service for wagering, betting decision-making or gambling promotion.",
            "Scrape, resell or republish Service content at scale without written permission.",
            "Attempt to disrupt, reverse-engineer or gain unauthorized access to the Service.",
            "Present FootIQ model output as verified fact when sharing it.",
          ]}
        />
      </ProseSection>

      <ProseSection title="4. Intellectual property">
        <p>
          The FootIQ name, interface, design system and model presentation are the property of the FootIQ team. Club names, crests and
          player imagery belong to their respective owners and appear for demonstration context only, without affiliation or endorsement.
        </p>
      </ProseSection>

      <ProseSection title="5. Algorithmically generated content">
        <p>
          Amber-marked content is produced by automated systems, not human editors, and is provided "as is". You are responsible for how
          you use it — it is informational analysis, not advice of any kind. See the{" "}
          <Link to="/disclaimer" className="text-accent-ink underline underline-offset-2 hover:text-ink">Disclaimer</Link> for the full statement.
        </p>
      </ProseSection>

      <ProseSection title="6. Limitation of liability">
        <p>
          To the maximum extent permitted by law, FootIQ shall not be liable for any indirect, incidental or consequential damages arising
          from use of the Service, including decisions made in reliance on predictions or statistics shown here.
        </p>
      </ProseSection>

      <ProseSection title="7. Changes">
        <p>
          These terms may be updated as the product moves from beta to general availability. Material changes will be reflected by the
          "last updated" date above. Continued use after changes constitutes acceptance.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
