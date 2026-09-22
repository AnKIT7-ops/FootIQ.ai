import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.join(import.meta.dirname, "shots");
mkdirSync(OUT, { recursive: true });

// Defaults to the local dev server; set VERIFY_BASE to sweep a deployed build.
const BASE = (process.env.VERIFY_BASE ?? "http://localhost:5173").replace(/\/$/, "");

const routes = [
  ["home", "/"],
  ["matches", "/matches"],
  ["match", "/match/ars-liv"],
  ["news", "/news"],
  ["player", "/player/saka"],
  ["player-slug", "/players/bukayo-saka"],
  ["similar", "/similar/saka"],
  ["compare", "/compare"],
  ["team", "/team/ars"],
  ["team-slug", "/teams/arsenal"],
  ["manager", "/managers/mikel-arteta"],
  ["intelligence", "/intelligence"],
  ["intel-article", "/intelligence/preview-manchester-city-vs-chelsea"],
  ["intel-analysis", "/intelligence/analysis-bukayo-saka"],
  ["prediction-detail", "/predictions/manchester-city-vs-chelsea"],
  ["history-moment", "/history/the-miracle-of-istanbul"],
  ["insights", "/insights"],
  ["transfers", "/transfers"],
  ["predictions", "/predictions"],
  ["scout", "/scout?q=left-footed%20winger%20under%20%E2%82%AC160M%20who%20excels%20at%20pressing"],
  ["tactics", "/tactics"],
  ["fantasy", "/fantasy"],
  ["highlights", "/highlights"],
  ["history", "/history"],
  ["profile", "/profile"],
  ["about", "/about"],
  ["contact", "/contact"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["disclaimer", "/disclaimer"],
  ["not-found", "/this-route-does-not-exist"],
];

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: "new",
  args: ["--no-first-run", "--disable-features=msEdgeSidebar", "--window-size=1440,1000"],
  defaultViewport: { width: 1440, height: 1000 },
});

const page = await browser.newPage();

// Puppeteer starts from a clean profile, so the first-visit tour would cover
// every screenshot. Mark it seen before any page script runs.
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem("footiq-onboarded", "1");
  } catch {
    /* best-effort */
  }
});

const problems = [];
page.on("console", (msg) => {
  if (msg.type() === "error") problems.push(`[console.error] ${msg.text().slice(0, 300)}`);
});
page.on("pageerror", (err) => problems.push(`[pageerror] ${String(err).slice(0, 300)}`));
page.on("requestfailed", (req) => {
  if (!req.url().includes("favicon")) problems.push(`[requestfailed] ${req.url()} — ${req.failure()?.errorText}`);
});

for (const [name, route] of routes) {
  problems.length = 0;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    const horiz = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`${name}: OK${horiz > 2 ? ` !! horizontal overflow ${horiz}px` : ""}${problems.length ? "\n  " + problems.join("\n  ") : ""}`);
  } catch (e) {
    console.log(`${name}: FAILED — ${String(e).slice(0, 200)}`);
  }
}

// mobile pass on key pages
await page.setViewport({ width: 390, height: 844 });
for (const [name, route] of [
  ["home-mobile", "/"],
  ["match-mobile", "/match/ars-liv"],
  ["tactics-mobile", "/tactics"],
  ["compare-mobile", "/compare"],
  ["contact-mobile", "/contact"],
]) {
  problems.length = 0;
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const horiz = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${name}: OK${horiz > 2 ? ` !! horizontal overflow ${horiz}px` : ""}${problems.length ? "\n  " + problems.join("\n  ") : ""}`);
}

await browser.close();
console.log("DONE");
