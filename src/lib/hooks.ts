import { useCallback, useEffect, useRef, useState } from "react";

export type Theme = "dark" | "light";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light") ? "light" : "dark",
  );

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      const root = document.documentElement;
      root.classList.toggle("light", next === "light");
      root.classList.toggle("dark", next === "dark");
      localStorage.setItem("footiq-theme", next);
      return next;
    });
  }, []);

  return [theme, toggle];
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full/unavailable — keep in-memory value */
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Animated count-up for stat tiles; respects reduced motion. */
export function useCountUp(target: number, duration = 900, decimals = 0): string {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, reduced]);

  return value.toFixed(decimals);
}

/** Global hotkey, e.g. useHotkey("k", true) for Ctrl/Cmd+K. */
export function useHotkey(key: string, withCtrl: boolean, handler: () => void): void {
  const cb = useRef(handler);
  cb.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (withCtrl && !(e.ctrlKey || e.metaKey)) return;
      if (!withCtrl) {
        const el = e.target as HTMLElement;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      }
      e.preventDefault();
      cb.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, withCtrl]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only the most recently opened trap handles Tab (e.g. Ctrl+K over the tour).
const trapStack: object[] = [];

/**
 * Modal focus trap. While `active`: focus moves into `ref` (the container
 * itself if it carries a tabindex, else its first focusable), Tab/Shift+Tab
 * cycle inside it, and on deactivate focus returns to whatever had it before.
 * Focusables are re-queried on every Tab, so content that changes while open
 * (search results, tour steps) is handled.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const token = {};
    trapStack.push(token);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.getClientRects().length > 0);

    const root = ref.current;
    if (root && !root.contains(document.activeElement)) (root.hasAttribute("tabindex") ? root : focusables()[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || trapStack[trapStack.length - 1] !== token) return;
      const els = focusables();
      const at = document.activeElement as HTMLElement | null;
      const first = els[0];
      const last = els[els.length - 1];
      if (!first) return e.preventDefault();
      if (!at || !els.includes(at) || at === (e.shiftKey ? first : last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trapStack.splice(trapStack.indexOf(token), 1);
      if (opener && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, [active, ref]);
}

/** IntersectionObserver-based reveal state for scroll animations. */
export function useInView<T extends HTMLElement>(threshold = 0.15): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/** Web Speech API voice input with graceful fallback when unsupported. */
export function useVoiceInput(onResult: (text: string) => void): { listening: boolean; supported: boolean; start: () => void; stop: () => void } {
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ start(): void; stop(): void } | null>(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  const SpeechRec =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : undefined;
  const supported = typeof SpeechRec === "function";

  const start = useCallback(() => {
    if (!supported || listening) return;
    const Ctor = SpeechRec as new () => {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: () => void;
      start(): void;
      stop(): void;
    };
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      cbRef.current(last[0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [supported, listening, SpeechRec]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
