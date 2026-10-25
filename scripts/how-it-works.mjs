// Renders the README's "How It Works" architecture diagram to PNG (3072x2048).
// Icons are the app's own lucide-react set; fonts are the app's (Archivo,
// Instrument Sans, IBM Plex Mono) from Google Fonts. Edit the cards/wires
// below and re-run when the architecture changes.
// usage: node scripts/how-it-works.mjs <projectDir> <chromeExe> <outPng>
//   e.g. node scripts/how-it-works.mjs . "<path to chrome or chrome-headless-shell>" docs/screenshots/how-it-works.png
//   (headless Edge exits at once on some Windows setups; `npx @puppeteer/browsers install chrome-headless-shell@stable` works)
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [projectArg, chromeExe, outPng] = process.argv.slice(2);
const projectDir = path.resolve(projectArg);
const require = createRequire(path.join(projectDir, "package.json"));
const puppeteer = require("puppeteer-core");

const ICONS = ["newspaper", "volleyball", "trophy", "file-text", "clock", "list-filter", "database", "library-big", "brain-circuit", "code-xml", "gauge", "app-window", "user-round"];
const iconNodes = {};
for (const name of ICONS) {
  const mod = await import(pathToFileURL(path.join(projectDir, "node_modules/lucide-react/dist/esm/icons", `${name}.js`)).href);
  iconNodes[name] = mod.__iconNode;
}
const icon = (name, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconNodes[name]
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("")}</svg>`;

const TILE = {
  blue: "linear-gradient(135deg,#4f8cff,#2563eb)",
  green: "linear-gradient(135deg,#6ee7b7,#10b981)",
  violet: "linear-gradient(135deg,#c4a1ff,#8b5cf6)",
  amber: "linear-gradient(135deg,#fcd34d,#f59e0b)",
  teal: "linear-gradient(135deg,#2dd4bf,#0f766e)",
  cyan: "linear-gradient(135deg,#67e8f9,#0891b2)",
  indigo: "linear-gradient(135deg,#a5b4fc,#6366f1)",
};

/** A card: absolute box with an icon tile and up to three text lines. */
const card = ({ x, y, w, h, iconName, tile, title, lines = [], rag = false, size = "lg", dashed = false }) => `
  <div class="card ${size}${dashed ? " dashed" : ""}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    ${rag ? '<span class="rag">RAG</span>' : ""}
    <div class="tile" style="background:${TILE[tile]}">${icon(iconName, size === "lg" ? 34 : 26)}</div>
    <div class="txt">
      <div class="t">${title}</div>
      ${lines.map((l, i) => `<div class="s${i === 0 && size === "lg" ? " s1" : ""}">${l}</div>`).join("")}
    </div>
  </div>`;

const panel = ({ x, y, w, h, n, title, sub, glow = false }) => `
  <div class="panel${glow ? " glow" : ""}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>
  <div class="num" style="left:${x + 24}px;top:${y + 20}px">${n}</div>
  <div class="ptitle" style="left:${x + 100}px;top:${y + 18}px">${title}</div>
  <div class="psub" style="left:${x + 100}px;top:${y + 56}px">${sub}</div>`;

// Orthogonal connectors: [points], arrowhead at the end unless noArrow.
const line = (pts, { dashed = false, noArrow = false } = {}) =>
  `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#5ee0f2" stroke-width="3" stroke-linejoin="round"${dashed ? ' stroke-dasharray="7 7"' : ""}${noArrow ? "" : ' marker-end="url(#head)"'}/>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#5ee0f2"/>`;
const label = (x, y, text, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="lbl">${text}</text>`;

// Layout (see comments for the grid): panel 1 sources, panel 2 backend in three columns, panel 3 web app.
const L = 676, M = 956, R = 1236, CW = 240, RW = 240; // backend columns
const ROW1 = 257, ROW2 = 415, CH = 100;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1536px; height: 1024px; position: relative; overflow: hidden; font-family: "Instrument Sans", sans-serif; color: #e8eefc;
    background: radial-gradient(1200px 700px at 50% 0%, #13284d 0%, #0b1a35 45%, #081226 100%); }
  .title { position: absolute; top: 22px; width: 100%; text-align: center; font: 800 66px "Archivo", sans-serif; letter-spacing: -0.5px; color: #fff; }
  .sub { position: absolute; top: 104px; width: 100%; text-align: center; font-size: 25px; color: #a9bbdc; }
  .panel { position: absolute; border: 1.5px solid #2b4a7e; border-radius: 22px; background: rgba(20, 38, 74, 0.45); }
  .panel.glow { border: 2px solid #3fd2e4; background: rgba(16, 52, 72, 0.42); box-shadow: 0 0 0 1px rgba(63,210,228,.15), 0 0 40px rgba(63,210,228,.18) inset; }
  .num { position: absolute; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; font: 700 30px "Instrument Sans";
    background: radial-gradient(circle at 35% 30%, #3b82f6, #1d4ed8); border: 2px solid #60a5fa; color: #fff; }
  .panel.glow + .num { background: radial-gradient(circle at 35% 30%, #0e7490, #0b4f63); border-color: #3fd2e4; }
  .ptitle { position: absolute; font: 700 30px "Instrument Sans"; letter-spacing: .3px; color: #fff; }
  .psub { position: absolute; font-size: 20px; color: #a9bbdc; }
  .card { position: absolute; display: flex; align-items: center; gap: 18px; padding: 0 18px; border-radius: 16px;
    border: 1.5px solid #2f4d7f; background: rgba(14, 28, 56, 0.92); }
  .card.dashed { border-style: dashed; border-color: #3fd2e4; }
  .tile { flex: none; display: grid; place-items: center; border-radius: 16px; }
  .card.lg .tile { width: 72px; height: 72px; }
  .card.sm { gap: 14px; padding: 0 14px; }
  .card.sm .tile { width: 52px; height: 52px; border-radius: 14px; }
  .t { font-weight: 700; color: #fff; white-space: nowrap; }
  .card.lg .t { font-size: 26px; }
  .card.sm .t { font-size: 18px; }
  .s { color: #a9bbdc; white-space: nowrap; margin-top: 4px; }
  .card.lg .s { font-size: 18px; }
  .card.lg .s1 { font-size: 21px; color: #c6d4ee; }
  .card.sm .s { font-size: 14px; margin-top: 2px; }
  .s.hi { color: #6ee7f5; }
  /* corner badge marking what the RAG work added */
  .rag { position: absolute; top: -11px; right: 14px; font: 500 12px "IBM Plex Mono"; letter-spacing: 1px; color: #5ee0f2;
    background: #0b1a35; border: 1px solid #3fd2e4; border-radius: 999px; padding: 2px 9px; }
  .metric { font-family: "IBM Plex Mono"; color: #6ee7b7 !important; }
  svg.wires { position: absolute; inset: 0; }
  .lbl { font: 500 14px "IBM Plex Mono"; fill: #8fdcea; }
</style></head><body>
  <div class="title">How It Works</div>
  <div class="sub">Data ingestion · retrieval · API · cited AI answers</div>

  ${panel({ x: 44, y: 160, w: 556, h: 570, n: 1, title: "FREE DATA SOURCES", sub: "Public data ingested on a schedule" })}
  ${panel({ x: 650, y: 160, w: 846, h: 570, n: 2, title: "API &amp; BACKEND", sub: "Hono on Cloudflare Workers", glow: true })}
  ${panel({ x: 44, y: 770, w: 1452, h: 210, n: 3, title: "WEB APP", sub: "Frontend and authentication" })}

  ${card({ x: 70, y: 257, w: 506, h: CH, iconName: "newspaper", tile: "blue", title: "News RSS", lines: ["BBC · The Guardian · Sky"] })}
  ${card({ x: 70, y: 372, w: 506, h: CH, iconName: "volleyball", tile: "green", title: "Football Data", lines: ["football-data.org", "Fixtures · Tables · Squads"] })}
  ${card({ x: 70, y: 487, w: 506, h: CH, iconName: "trophy", tile: "violet", title: "Fantasy Premier League", lines: ["Players · Fantasy"] })}
  ${card({ x: 70, y: 602, w: 506, h: CH, iconName: "file-text", tile: "amber", title: "Guardian Open Platform", lines: ["Full-text match reports · News"], rag: true })}

  ${card({ x: L, y: ROW1, w: CW, h: CH, size: "sm", iconName: "clock", tile: "teal", title: "Cron Sync Jobs", lines: ["Every 30 minutes"] })}
  ${card({ x: L, y: ROW2, w: CW, h: CH, size: "sm", iconName: "list-filter", tile: "teal", title: "Knowledge Sync", lines: ["Every 3 hours", "validate → embed"], rag: true })}
  ${card({ x: M, y: ROW1, w: CW, h: CH, size: "sm", iconName: "database", tile: "blue", title: "Snapshots", lines: ['<span class="s hi">Supabase Postgres</span>'] })}
  ${card({ x: M, y: ROW2, w: CW, h: CH, size: "sm", iconName: "library-big", tile: "cyan", title: "Knowledge Base", lines: ['<span class="s hi">pgvector</span> · 768-d', "308 chunks"], rag: true })}
  ${card({ x: R, y: ROW1, w: RW, h: CH, size: "sm", iconName: "brain-circuit", tile: "indigo", title: "AI Answers", lines: ["Gemini · cached", "cited [n] sources"] })}
  ${card({ x: R, y: ROW2, w: RW, h: CH, size: "sm", iconName: "code-xml", tile: "teal", title: "/api/*", lines: ["retrieve → answer"] })}
  ${card({ x: L, y: 592, w: 520, h: 108, size: "sm", iconName: "gauge", tile: "green", title: "Retrieval Evals", lines: ["36-question golden set", '<span class="metric">recall@6 100% · hit@1 86.7% · MRR 0.925</span>'], dashed: true })}

  ${card({ x: 830, y: 840, w: 330, h: 100, iconName: "user-round", tile: "green", title: "Supabase Auth" })}
  ${card({ x: R - 8, y: 840, w: RW + 16, h: 100, iconName: "app-window", tile: "blue", title: "React App", lines: ["Vercel"] })}

  <svg class="wires" width="1536" height="1024">
    <defs><marker id="head" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#5ee0f2"/></marker></defs>
    <!-- sources → cron (trunk A) -->
    ${line([[576, 307], [618, 307]], { noArrow: true })}
    ${line([[576, 422], [618, 422]], { noArrow: true })}
    ${line([[576, 537], [618, 537]], { noArrow: true })}
    ${line([[618, 537], [618, 307], [L - 4, 307]])}
    ${dot(618, 422)}
    <!-- Guardian → knowledge sync (trunk B) -->
    ${line([[576, 652], [634, 652], [634, 465], [L - 4, 465]])}
    <!-- jobs → stores -->
    ${line([[L + CW, 307], [M - 4, 307]])}
    ${line([[L + CW, 465], [M - 4, 465]])}
    <!-- stores → api -->
    ${line([[M + CW, 325], [1216, 325], [1216, 445], [R - 4, 445]])}
    ${line([[M + CW, 485], [R - 4, 485]])}
    <!-- api → AI answers -->
    ${line([[R + RW / 2, ROW2], [R + RW / 2, ROW1 + CH + 4]])}
    ${label(R + RW / 2 - 12, 391, "top-6 chunks", "end")}
    <!-- knowledge base → evals -->
    ${line([[M + CW / 2, ROW2 + CH], [M + CW / 2, 588]], { dashed: true })}
    ${label(M + CW / 2 + 10, 558, "golden set")}
    <!-- web app → api, auth -->
    ${line([[R + RW / 2, 840], [R + RW / 2, ROW2 + CH + 4]])}
    ${line([[R - 8, 890], [1164, 890]])}
  </svg>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: chromeExe, headless: true, defaultViewport: { width: 1536, height: 1024, deviceScaleFactor: 2 } });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
// Fail loudly if any card's text overflows its box.
const overflow = await page.$$eval(".card", (cards) =>
  cards
    .filter((c) => [...c.querySelectorAll(".t, .s")].some((t) => t.getBoundingClientRect().right > c.getBoundingClientRect().right - 8))
    .map((c) => c.querySelector(".t").innerText),
);
if (overflow.length) console.log("OVERFLOW:", overflow);
await page.screenshot({ path: outPng });
await browser.close();
console.log("wrote", outPng);
