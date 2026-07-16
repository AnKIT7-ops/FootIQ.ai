import { SITE_URL } from "@/lib/seo";
import { bump } from "@/lib/metrics";
import { track } from "@/lib/analytics";

/**
 * Share layer — copy link, native share sheet, and downloadable 1200×630
 * share cards rendered from a hand-built SVG (no html2canvas, no deps).
 * Cards use the export palette (fixed dark, floodlit-night) regardless of
 * the viewer's theme, and a system font stack: webfonts don't load inside
 * canvas-rasterised SVG documents.
 */

export interface ShareCardOpts {
  /** Big display line, e.g. player name or article title. */
  title: string;
  /** Eyebrow above the title, e.g. "Player Analysis". */
  kind?: string;
  /** Emphasis stat line under the title, e.g. "Rating 7.82 · 14G 6A". */
  stat?: string;
  /** Site path shown in the footer and encoded in the shared URL. */
  path: string;
}

export async function copyLink(path: string): Promise<boolean> {
  const url = `${SITE_URL}${path}`;
  try {
    await navigator.clipboard.writeText(url);
    bump("share", path);
    track("share_clicked", { channel: "copy", path });
    return true;
  } catch {
    return false;
  }
}

/** Native share sheet where available; falls back to clipboard. Returns the channel used. */
export async function webShare(title: string, path: string): Promise<"shared" | "copied" | "failed"> {
  const url = `${SITE_URL}${path}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `${title} · FootIQ`, url });
      bump("share", path);
      track("share_clicked", { channel: "native", path });
      return "shared";
    } catch {
      return "failed"; // user dismissed the sheet — don't double-fire the clipboard
    }
  }
  return (await copyLink(path)) ? "copied" : "failed";
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy line wrap for the SVG title (no text measurement — mono-ish estimate). */
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > perLine && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{3}$/, "") + "…";
  }
  return lines;
}

export function shareCardSVG({ title, kind, stat, path }: ShareCardOpts): string {
  const lines = wrap(title, 26, 3);
  const sans = "system-ui, 'Segoe UI', Arial, sans-serif";
  const mono = "'Cascadia Mono', Consolas, 'Courier New', monospace";
  const titleSpans = lines
    .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 76}">${esc(l)}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="85%" cy="0%" r="90%">
      <stop offset="0%" stop-color="#233457"/><stop offset="55%" stop-color="#101a30"/><stop offset="100%" stop-color="#0a1020"/>
    </radialGradient>
    <linearGradient id="pitch" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="1050" cy="120" r="260" fill="none" stroke="#2a3a5e" stroke-width="1.5" opacity="0.6"/>
  <circle cx="1050" cy="120" r="180" fill="none" stroke="#2a3a5e" stroke-width="1.5" opacity="0.45"/>
  <rect x="0" y="0" width="1200" height="6" fill="url(#pitch)"/>
  <text x="80" y="96" font-family="${mono}" font-size="24" letter-spacing="6" fill="#8fa3c2" text-transform="uppercase">${esc((kind ?? "FOOTBALL INTELLIGENCE").toUpperCase())}</text>
  ${kind ? `<rect x="80" y="118" width="54" height="4" rx="2" fill="#fbbf24"/>` : ""}
  <text x="80" y="230" font-family="${sans}" font-size="64" font-weight="800" fill="#f2f6fc">${titleSpans}</text>
  ${stat ? `<text x="80" y="${250 + lines.length * 76}" font-family="${mono}" font-size="30" fill="#fbbf24">✦ ${esc(stat)}</text>` : ""}
  <text x="80" y="556" font-family="${sans}" font-size="34" font-weight="800" fill="#f2f6fc">Foot<tspan fill="#10b981">IQ</tspan></text>
  <text x="80" y="586" font-family="${mono}" font-size="20" fill="#8fa3c2">${esc(`footiq.ai${path}`)}</text>
  <text x="1120" y="586" text-anchor="end" font-family="${mono}" font-size="18" fill="#5d6f8d">AI ANALYSIS — NOT VERIFIED FACT</text>
</svg>`;
}

/** Render the share card to PNG and trigger a download. */
export async function downloadShareCard(opts: ShareCardOpts): Promise<boolean> {
  try {
    const svg = shareCardSVG(opts);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg rasterise failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    canvas.getContext("2d")!.drawImage(img, 0, 0, 1200, 630);
    URL.revokeObjectURL(url);

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = `footiq-${opts.path.split("/").filter(Boolean).join("-") || "card"}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    bump("share", opts.path);
    track("share_image_exported", { path: opts.path });
    return true;
  } catch {
    return false;
  }
}
