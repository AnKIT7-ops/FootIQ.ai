/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * sitemap.xml at build time, from the exact same slug builders and content
 * engine the app routes with — the sitemap can never drift from the URLs.
 * (Dataset + engine modules are alias-free/pure, so Node can import them here.)
 *
 * Then every sitemap URL whose content is known at build time gets its own
 * dist/<path>/index.html: the built shell with that page's head (title, description,
 * canonical, OG/Twitter, JSON-LD — from the same page-meta.ts + seo.ts the page uses)
 * and a short semantic summary in #root for clients that don't run JS. Vercel
 * serves real files before vercel.json rewrites, so these win over the SPA fallback.
 */
function sitemapPlugin(): Plugin {
  return {
    name: "footiq-sitemap",
    apply: "build",
    generateBundle: {
      order: "post", // after vite:build-html has put index.html in the bundle
      async handler(_options, bundle) {
        const [{ teams }, { historicalMoments }, content, slugs, nav, seo, pageMeta] = await Promise.all([
          import("./src/data/teams"),
          import("./src/data/history"),
          import("./src/data/content"),
          import("./src/lib/slug-builders"),
          import("./src/lib/nav"),
          import("./src/lib/seo"),
          import("./src/lib/page-meta"),
        ]);

        const site = process.env.VITE_SITE_URL as string; // validated + normalised in defineConfig
        const noIndex = new Set(["/profile", "/insights"]);
        const paths = [
          // Not listed: /intelligence and its articles. The library is generated from
          // demo data and gated off on live data (src/lib/repositories/content.ts);
          // this build is the live deploy.
          ...[...nav.pageEntries, ...nav.legalEntries].map((e) => e.to).filter((p) => p !== "/intelligence"),
          // Not listed: players. They sync from FPL at runtime, so the build can't
          // see them; a sitemap route on the API is the upgrade path.
          ...teams.map(slugs.teamPathFor),
          ...teams.map(slugs.managerPathFor),
          // Not listed: demo fixtures, demo predictions and demo news. They describe
          // real clubs and people (invented scores, quotes, "exclusives"); search
          // engines must not index them as fact. Real fixtures change daily and are
          // reached through /matches and /predictions.
          ...historicalMoments.map(slugs.momentPathFor),
        ].filter((p) => !noIndex.has(p));

        const lastmod = content.weekStamp();
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          [...new Set(paths)]
            .map((p) => `  <url><loc>${site}${p}</loc><lastmod>${lastmod}</lastmod></url>`)
            .join("\n") +
          `\n</urlset>\n`;

        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml });
        console.log(`\n[sitemap] ${new Set(paths).size} URLs → dist/sitemap.xml`);

        this.emitFile({
          type: "asset",
          fileName: "robots.txt",
          source: `User-agent: *\nAllow: /\nDisallow: /profile\nDisallow: /insights\n\nSitemap: ${site}/sitemap.xml\n`,
        });

        // ---- prerendered entry HTML ----------------------------------------
        // Not prerendered (served by the SPA shell): "/" — dist/index.html is also the
        // fallback for every other route — and /similar, whose title names a runtime FPL player.
        const shell = bundle["index.html"];
        if (shell?.type !== "asset") throw new Error("[prerender] index.html missing from the bundle");
        const html = String(shell.source);
        if (!html.includes(`<div id="root"></div>`)) throw new Error("[prerender] empty #root not found in index.html");

        const listed = new Set(paths);
        const link = (to: string, label: string) => `<a href="${esc(to)}">${esc(label)}</a>`;
        const navLinks =
          `<nav aria-label="FootIQ"><ul>` +
          [...nav.pageEntries, ...nav.legalEntries]
            .filter((e) => listed.has(e.to))
            .map((e) => `<li>${link(e.to, e.label)}</li>`)
            .join("") +
          `</ul></nav>`;

        // Body = what the page itself shows first, from the same datasets. Nothing
        // runtime-only (standings, squads, fixtures, FPL players) — that stays client-side.
        const pages = [
          ...Object.values(pageMeta.staticPageMeta).map((meta) => ({
            meta,
            body: `<h1>${esc(meta.title)}</h1><p>${esc(meta.description)}</p>`,
          })),
          ...teams.map((t) => {
            const meta = pageMeta.teamPageMeta(t);
            return {
              meta,
              body:
                `<h1>${esc(t.name)}</h1><p>${esc(`${t.league} · ${t.stadium}`)}</p>` +
                `<p>Manager: ${link(slugs.managerPathFor(t), t.manager)}</p><p>${esc(meta.description ?? "")}</p>`,
            };
          }),
          ...teams.map((t) => {
            const meta = pageMeta.managerPageMeta(t);
            return {
              meta,
              body:
                `<h1>${esc(t.manager)}</h1><p>Manager · ${link(slugs.teamPathFor(t), t.name)}</p>` +
                `<p>${esc(meta.description ?? "")}</p>`,
            };
          }),
          ...historicalMoments.map((m) => ({
            meta: pageMeta.momentPageMeta(m),
            body:
              `<p>${esc(`${m.year} · ${m.kind}`)}</p><h1>${esc(m.title)}</h1>` +
              `<p>${esc(m.subtitle)}</p><p>${esc(m.detail)}</p>` +
              `<p>${esc(`${m.stat.value} — ${m.stat.label}`)}</p><p>${link("/history", "All moments")}</p>`,
          })),
        ].filter((p) => listed.has(p.meta.path));

        for (const { meta, body } of pages) {
          const head = seo.pageHead(meta);
          const keys = head.meta.map((m) => m.key);
          const tags =
            `<title>${esc(head.title)}</title>\n` +
            `    <link rel="canonical" href="${esc(head.canonical)}" />\n` +
            head.meta.map((m) => `    <meta ${m.attr}="${m.key}" content="${esc(m.content)}" />\n`).join("") +
            // id = applyPageMeta's managed block, so the app replaces it on mount; `<` escaped so data can't close the tag
            (head.jsonLd
              ? `    <script type="application/ld+json" id="footiq-jsonld">${head.jsonLd.replace(/</g, "\\u003c")}</script>\n`
              : "");
          const out = html
            .replace(/<title>[\s\S]*?<\/title>\s*/, "")
            .replace(/<link rel="canonical"[^>]*>\s*/, "")
            .replace(new RegExp(`<meta\\s+(?:name|property)="(?:${keys.join("|")})"[^>]*>\\s*`, "g"), "")
            .replace("</head>", `  ${tags}  </head>`)
            .replace(`<div id="root"></div>`, `<div id="root"><main class="prerender">${body}${navLinks}</main></div>`);
          // the shell's tags must have been swapped, not duplicated
          for (const needle of ["<title>", `rel="canonical"`, ...keys.map((k) => `="${k}"`)]) {
            if (out.split(needle).length !== 2) throw new Error(`[prerender] ${meta.path}: expected exactly one ${needle}`);
          }
          this.emitFile({ type: "asset", fileName: `${meta.path.slice(1)}/index.html`, source: out });
        }
        const skipped = [...listed].filter((p) => !pages.some((x) => x.meta.path === p));
        console.log(`[prerender] ${pages.length}/${listed.size} sitemap URLs → dist/<path>/index.html (shell only: ${skipped.join(", ")})`);
      },
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // The one public origin behind every absolute URL the build ships: index.html
  // (%VITE_SITE_URL%), sitemap.xml, robots.txt and src/lib/seo.ts. Vercel previews
  // don't get VITE_SITE_URL, so they use their own deploy URL; local dev uses localhost.
  const preview =
    process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const site = (
    loadEnv(mode, import.meta.dirname, "VITE_").VITE_SITE_URL ||
    preview ||
    (command === "serve" ? "http://localhost:5173" : "")
  ).replace(/\/$/, "");
  if (!site) {
    throw new Error(
      "VITE_SITE_URL is not set. Production builds need the site's public origin " +
        "(e.g. VITE_SITE_URL=https://footiq-omega.vercel.app) for canonical, Open Graph, sitemap and robots URLs.",
    );
  }
  // Normalised (no trailing slash) and handed back: Vite's env loading prefers
  // process.env over .env files, so index.html, import.meta.env, sitemapPlugin and the
  // prerender (which loads src/lib/seo.ts in plain Node, reading process.env) all see this value.
  process.env.VITE_SITE_URL = site;

  return {
    plugins: [react(), tailwindcss(), sitemapPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // long-cache vendor chunks: app code changes shouldn't bust react/motion in users' caches
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-motion": ["motion"],
          },
        },
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
