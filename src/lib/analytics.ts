/**
 * Analytics bootstrap — Google Analytics 4 + Microsoft Clarity.
 * Both are opt-in via environment variables and stay fully disabled when unset:
 *   VITE_GA_ID      e.g. "G-XXXXXXXXXX"
 *   VITE_CLARITY_ID e.g. "abcdefghij"
 * No IDs are hardcoded; without them this module injects nothing.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID as string | undefined;

export const analyticsEnabled = Boolean(GA_ID || CLARITY_ID);

let initialized = false;

/** Inject analytics scripts once. Safe to call unconditionally — no-op without env IDs. */
export function initAnalytics(): void {
  if (initialized || typeof document === "undefined") return;
  initialized = true;

  if (GA_ID) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    // SPA: page_view is sent manually from the router on every navigation
    window.gtag("config", GA_ID, { send_page_view: false });
  }

  if (CLARITY_ID) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`;
    document.head.appendChild(s);
  }
}

/** Report an SPA page view (call on every route change). No-op when GA is disabled. */
export function trackPageView(path: string): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Generic event helper for future funnels (waitlist joins, searches). */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}
