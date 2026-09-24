// Renders public/og.png (1200×630) from an inline HTML card — floodlit-night branding.
// Run: node scripts/og.mjs   (requires Edge, same as scripts/verify.mjs)
import puppeteer from "puppeteer-core";
import path from "node:path";

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: "Segoe UI", system-ui, sans-serif;
    background:
      radial-gradient(900px 420px at 16% -8%, rgba(16,185,129,0.16), transparent 60%),
      radial-gradient(760px 380px at 86% -14%, rgba(56,189,248,0.12), transparent 55%),
      radial-gradient(700px 500px at 82% 118%, rgba(251,191,36,0.10), transparent 60%),
      #0a0e16;
    color: #eef2f8; display: flex; flex-direction: column; justify-content: space-between;
    padding: 64px 72px 56px; position: relative;
  }
  .grid {
    position: absolute; inset: 0; opacity: 0.5;
    background-image: linear-gradient(rgba(226,236,248,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(226,236,248,0.045) 1px, transparent 1px);
    background-size: 72px 72px;
  }
  .row { display: flex; align-items: center; gap: 22px; position: relative; }
  .word { font-size: 58px; font-weight: 900; letter-spacing: -1px; }
  .word i { font-style: normal; color: #fcd34d; }
  .tag { position: relative; font-size: 76px; line-height: 1.06; font-weight: 900; letter-spacing: -2px; max-width: 980px; text-transform: uppercase; }
  .tag .a { color: #5eead4; }
  .foot { position: relative; display: flex; align-items: center; justify-content: space-between; }
  .chips { display: flex; gap: 14px; }
  .chip { font-family: Consolas, monospace; font-size: 21px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 24px; border-radius: 999px; border: 1.5px solid; }
  .chip.fact { color: #5eead4; border-color: rgba(16,185,129,0.55); background: rgba(16,185,129,0.10); }
  .chip.ai { color: #fcd34d; border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.08); }
  .beta { font-family: Consolas, monospace; font-size: 21px; letter-spacing: 3px; text-transform: uppercase; color: #9aa7ba; }
</style></head><body>
  <div class="grid"></div>
  <div class="row">
    <svg width="84" height="84" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1d2533"/><path d="M32 14a18 18 0 0 0 0 36" fill="none" stroke="#10b981" stroke-width="6"/><path d="M32 14a18 18 0 0 1 0 36" fill="none" stroke="#fbbf24" stroke-width="6"/><path d="M32 0v64" stroke="#eef2f8" stroke-width="3"/><circle cx="32" cy="32" r="4.5" fill="#eef2f8"/></svg>
    <div class="word">Foot<i>IQ</i></div>
  </div>
  <div class="tag">Not the scores.<br><span class="a">The reasons.</span></div>
  <div class="foot">
    <div class="chips">
      <span class="chip fact">Emerald = Fact</span>
      <span class="chip ai">Amber = AI</span>
    </div>
    <div class="beta">AI Football Intelligence · Beta</div>
  </div>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: "new",
  args: ["--no-first-run"],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
const out = path.join(import.meta.dirname, "..", "public", "og.png");
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
