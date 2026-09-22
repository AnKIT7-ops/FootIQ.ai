import { describe, expect, it } from "vitest";
import { categorize, fetchHeadlines, parseFeed, plainSummary } from "./news-rss";

// Shapes copied from the live feeds (2026-09-22).
const BBC = `<rss><channel><title>BBC Sport</title>
<item>
  <title><![CDATA[Arteta agrees new deal with champions Arsenal]]></title>
  <description><![CDATA[Mikel Arteta agrees an improved new contract with Premier League champions Arsenal.]]></description>
  <link>https://www.bbc.co.uk/sport/football/articles/ckd68e40ze3jo?at_medium=RSS&amp;at_campaign=rss</link>
  <pubDate>Tue, 22 Sep 2026 14:25:43 GMT</pubDate>
  <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/ace/standard/240/x.png"/>
</item></channel></rss>`;

const GUARDIAN = `<rss><channel><item>
  <title>Saka ruled out for a month with hamstring injury</title>
  <link>https://www.theguardian.com/football/2026/sep/22/saka-hamstring</link>
  <description>&lt;p&gt;Arsenal&amp;#8217;s winger will miss &lt;strong&gt;four games&lt;/strong&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Buy a cartoon&lt;/li&gt;&lt;/ul&gt;</description>
  <pubDate>Tue, 22 Sep 2026 15:20:05 GMT</pubDate>
</item></channel></rss>`;

const SKY = `<rss><channel>
<item><title><![CDATA[Great Britain out of Billie Jean King Cup Finals]]></title><description><![CDATA[Tennis.]]></description>
  <link>https://www.skysports.com/tennis/news/12110/1</link><pubDate>Tue, 22 Sep 2026 15:30:00 BST</pubDate></item>
<item><title><![CDATA[Villa beat Spurs 2-1]]></title><description><![CDATA[Report.]]></description>
  <link>https://www.skysports.com/football/news/12040/2</link><pubDate>Tue, 22 Sep 2026 15:00:00 BST</pubDate></item>
</channel></rss>`;

describe("RSS headlines", () => {
  it("parses CDATA, strips tracking params and reads the thumbnail", () => {
    const [h] = parseFeed(BBC, "BBC Sport");
    expect(h.title).toBe("Arteta agrees new deal with champions Arsenal");
    expect(h.url).toBe("https://www.bbc.co.uk/sport/football/articles/ckd68e40ze3jo");
    expect(h.imageUrl).toContain("ichef.bbci.co.uk");
    expect(h.publishedIso).toBe("2026-09-22T14:25:43.000Z");
    expect(h.category).toBe("Transfers"); // "new deal" / contract
  });

  it("turns HTML summaries into plain text, first paragraph only", () => {
    const [h] = parseFeed(GUARDIAN, "The Guardian");
    expect(h.summary).toBe("Arsenal’s winger will miss four games");
    expect(h.category).toBe("Injuries");
  });

  it("applies the feed filter (Sky's football feed leaks tennis)", () => {
    const items = parseFeed(SKY, "Sky Sports", (l) => l.includes("/football/"));
    expect(items.map((i) => i.title)).toEqual(["Villa beat Spurs 2-1"]);
    expect(items[0].category).toBe("Results");
  });

  it("truncates long summaries on a word boundary", () => {
    const s = plainSummary(`<p>${"word ".repeat(100)}</p>`);
    expect(s.length).toBeLessThanOrEqual(280);
    expect(s.endsWith("…")).toBe(true);
  });

  it("defaults to News for plain stories", () => {
    expect(categorize("England name squad for Spain", "")).toBe("News");
  });

  it("survives one feed failing and dedupes, newest first", async () => {
    const fake = (async (url: string) => {
      if (String(url).includes("guardian")) return new Response("down", { status: 503 });
      if (String(url).includes("bbci")) return new Response(BBC);
      return new Response(SKY);
    }) as typeof fetch;
    const all = await fetchHeadlines(fake);
    expect(all.map((h) => h.source)).toEqual(["BBC Sport", "Sky Sports"]);
  });

  it("throws only when every feed fails", async () => {
    const down = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchHeadlines(down)).rejects.toThrow(/all news feeds failed/);
  });
});
