import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * sitemap.xml at build time, from the exact same slug builders and content
 * engine the app routes with — the sitemap can never drift from the URLs.
 * (Dataset + engine modules are alias-free/pure, so Node can import them here.)
 */
function sitemapPlugin(): Plugin {
  return {
    name: "footiq-sitemap",
    apply: "build",
    async generateBundle() {
      const [{ players }, { teams }, { matches }, { news }, { historicalMoments }, { predictionByMatch }, content, slugs, nav] =
        await Promise.all([
          import("./src/data/players"),
          import("./src/data/teams"),
          import("./src/data/matches"),
          import("./src/data/news"),
          import("./src/data/history"),
          import("./src/data/predictions"),
          import("./src/data/content"),
          import("./src/lib/slug-builders"),
          import("./src/lib/nav"),
        ]);

      const site = (process.env.VITE_SITE_URL ?? "https://footiq.ai").replace(/\/$/, "");
      const noIndex = new Set(["/profile", "/insights"]);
      const paths = [
        ...[...nav.pageEntries, ...nav.legalEntries].map((e) => e.to),
        "/intelligence",
        ...players.map(slugs.playerPathFor),
        ...teams.map(slugs.teamPathFor),
        ...teams.map(slugs.managerPathFor),
        ...matches.map((m) => slugs.matchPathFor(m, teams)),
        ...matches.filter((m) => predictionByMatch.has(m.id)).map((m) => slugs.predictionPathFor(m, teams)),
        ...news.map(slugs.newsPathFor),
        ...historicalMoments.map(slugs.momentPathFor),
        ...content.contentLibrary().map((a) => `/intelligence/${a.slug}`),
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
    },
  };
}

export default defineConfig({
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
});
