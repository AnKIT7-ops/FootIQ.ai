import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge, Reliability } from "@/components/ui/Badge";
import { Crest } from "@/components/ui/Crest";
import { Tabs } from "@/components/ui/Tabs";
import { IQInsight } from "@/components/ui/IQInsight";
import { news } from "@/lib/repositories/news";
import { agoFromMinutes } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";

const cats = ["All", "Transfers", "Match Report", "Tactics", "Injury", "Rumour", "Interview"];

export default function News() {
  usePageMeta({
    title: "News Intelligence",
    description: "Football news AI-summarized to 30-second reads, with source-reliability scoring on every story.",
    path: "/news",
  });
  const [cat, setCat] = useState("All");
  const navigate = useNavigate();
  const list = useMemo(() => (cat === "All" ? news : news.filter((n) => n.category === cat)), [cat]);
  const [lead, ...rest] = list;

  return (
    <div className="space-y-6">
      <SectionHeader level={1} eyebrow="Every story, 30 seconds" title="News Intelligence" />
      <Tabs id="news" tabs={cats.map((c) => ({ value: c, label: c }))} active={cat} onChange={setCat} className="max-w-full" />

      {lead && (
        <Card hover onClick={() => navigate(`/news/${lead.id}`)} className="floodlight relative overflow-hidden p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={lead.category === "Rumour" ? "warn" : "accent"}>{lead.category}</Badge>
            <Reliability score={lead.reliability} />
            <span className="ml-auto font-mono text-[11px] text-ink-3">{agoFromMinutes(lead.minutesAgo)} · {lead.source}</span>
          </div>
          <h2 className="mt-3 max-w-3xl text-xl font-bold leading-snug text-ink md:text-2xl">{lead.title}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <ul className="max-w-2xl space-y-1.5">
              {lead.aiSummary.map((s, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-2">
                  <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-iq" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
            <div className="flex items-end gap-1.5 md:flex-col md:items-end">
              {lead.teamIds.slice(0, 2).map((t) => (
                <Crest key={t} teamId={t} size={34} />
              ))}
            </div>
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-accent-ink">Read in {lead.readSeconds}s →</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        <div className="space-y-3">
          {rest.map((n) => (
            <Card hover key={n.id} onClick={() => navigate(`/news/${n.id}`)} className="p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Badge variant={n.category === "Rumour" ? "warn" : "neutral"}>{n.category}</Badge>
                <Reliability score={n.reliability} />
                <span className="ml-auto font-mono text-[10.5px] text-ink-3">{agoFromMinutes(n.minutesAgo)}</span>
              </div>
              <h3 className="mt-2.5 text-[15px] font-bold leading-snug text-ink">{n.title}</h3>
              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{n.aiSummary[0]}</p>
              <div className="mt-3 flex items-center gap-2">
                {n.teamIds.slice(0, 3).map((t) => (
                  <Crest key={t} teamId={t} size={20} />
                ))}
                <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wider text-accent-ink">{n.readSeconds}s read →</span>
              </div>
            </Card>
          ))}
          {rest.length === 0 && !lead && <p className="py-10 text-center text-sm text-ink-3">No stories in this category yet.</p>}
        </div>

        <div className="space-y-4">
          <IQInsight title="Personalized for you">
            You follow <strong>Arsenal</strong> and <strong>Bukayo Saka</strong> — today's must-read is the live title six-pointer report,
            and the Rodri injury desk affects your fantasy captaincy chain.
          </IQInsight>
          <Card className="p-4">
            <p className="eyebrow mb-3">How reliability works</p>
            <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-ink-2">
              <li className="flex gap-2.5"><Reliability score={5} className="mt-0.5 shrink-0" /> Verified: multi-source or first-party data.</li>
              <li className="flex gap-2.5"><Reliability score={3} className="mt-0.5 shrink-0" /> Reliable: strong outlet, single source.</li>
              <li className="flex gap-2.5"><Reliability score={1} className="mt-0.5 shrink-0" /> Speculative: uncorroborated — labeled, never hidden.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
