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
  ["schedule", "/schedule"],
  ["match", "/match/ars-liv"],
  ["news", "/news"],
  ["player-slug", "/players/bukayo-saka"],
  ["player-legacy-id", "/player/fpl-223340"],
  ["similar", "/similar/fpl-223340"],
  ["similar-index", "/similar"],
  ["compare", "/compare"],
  ["team", "/team/ars"],
  ["team-slug", "/teams/arsenal"],
  ["manager", "/managers/mikel-arteta"],
  ["intelligence", "/intelligence"],
  ["intel-article", "/intelligence/preview-manchester-city-vs-chelsea"],
  ["prediction-detail", "/predictions/manchester-city-vs-chelsea"],
  ["history-moment", "/history/the-miracle-of-istanbul"],
  ["insights", "/insights"],
  ["transfers", "/transfers"],
  ["predictions", "/predictions"],
  ["scout", "/scout?q=young%20midfielder%20who%20creates%20chances"],
  ["tactics", "/tactics"],
  ["fantasy", "/fantasy"],
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

// Mobile pass: a real touch-phone emulation, every route. body{overflow-x:hidden}
// hides overflow from scrollWidth, but a phone still grows its layout viewport to
// fit the widest box — every fixed layer (bottom nav) then lays out off-screen.
// So check innerWidth and element right edges instead, and fail the run.
const MOBILE = { width: 375, height: 812 };
await page.setViewport({ ...MOBILE, isMobile: true, hasTouch: true });
let mobileFailures = 0;
for (const [name, route] of routes) {
  problems.length = 0;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(OUT, `${name}-mobile.png`) });
    const { innerWidth, offenders } = await page.evaluate((vw) => {
      // An element inside a horizontal scroller (or clipper) can't widen the page.
      const contained = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== "visible") return true;
        }
        return false;
      };
      const offenders = [];
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1 || contained(el)) continue;
        if (offenders.some((o) => o.el.contains(el))) continue; // report the outermost box only
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
        offenders.push({ el, desc: `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} (right ${Math.round(r.right)}px)` });
      }
      return { innerWidth: window.innerWidth, offenders: offenders.slice(0, 3).map((o) => o.desc) };
    }, MOBILE.width);
    const bad = innerWidth > MOBILE.width || offenders.length > 0;
    if (bad) mobileFailures++;
    const detail = bad
      ? ` !! layout viewport ${innerWidth}px on a ${MOBILE.width}px phone${offenders.length ? `; past the edge: ${offenders.join(", ")}` : ""}`
      : "";
    console.log(`${name}-mobile: ${bad ? "FAIL" : "OK"}${detail}${problems.length ? "\n  " + problems.join("\n  ") : ""}`);
  } catch (e) {
    mobileFailures++;
    console.log(`${name}-mobile: FAILED — ${String(e).slice(0, 200)}`);
  }
}

await browser.close();
if (mobileFailures) {
  console.log(`MOBILE OVERFLOW on ${mobileFailures} route(s)`);
  process.exitCode = 1;
}
console.log("DONE");
