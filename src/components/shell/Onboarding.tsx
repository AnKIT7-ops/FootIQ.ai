import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, ClipboardList, Search, Sparkles, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * First-visit tour — 4 skippable steps that answer "what is FootIQ" in under
 * 30 seconds. Shows once (localStorage `footiq-onboarded`), re-launchable from
 * the TopBar help button and /about. Closing at any point counts as seen.
 */

const KEY = "footiq-onboarded";

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(KEY) === null;
  } catch {
    return false;
  }
}

function markOnboarded(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* best-effort */
  }
}

const steps = [
  {
    icon: Sparkles,
    eyebrow: "Welcome to FootIQ",
    title: "The AI intelligence layer for football",
    body: "Scores tell you what happened. FootIQ helps you understand why — AI analysis on every player, team, match and transfer, grounded in structured performance data.",
    cta: null,
  },
  {
    icon: Search,
    eyebrow: "AI Scout",
    title: "Describe a player. We'll find them.",
    body: "Type plain language — “left-footed winger under €30M who presses hard” — and get ranked matches with fit scores. Also works straight from search: type a question and press Enter.",
    cta: { label: "Try AI Scout", to: "/scout" },
  },
  {
    icon: ClipboardList,
    eyebrow: "Tactics & Predictions",
    title: "Build XIs. Stress-test outcomes.",
    body: "Drag players onto the Tactical Board to shape your ideal lineup, and read match predictions as probabilities — home, draw, away — never as certainties.",
    cta: { label: "Open Tactical Board", to: "/tactics" },
  },
  {
    icon: BadgeCheck,
    eyebrow: "How to read FootIQ",
    title: "Green is fact. Amber is AI.",
    body: "Verified data points are emerald. Anything a model inferred is amber and carries its generation time and sources — so you always know what you're looking at. AI analysis is speculative, never betting advice.",
    cta: { label: "Start exploring", to: null },
  },
] as const;

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (reason: "completed" | "skipped") => {
    markOnboarded();
    track(reason === "completed" ? "onboarding_completed" : "onboarding_skipped", { step });
    onClose();
  };

  useEffect(() => {
    if (open) {
      setStep(0);
      setTimeout(() => panelRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("skipped");
      if (e.key === "ArrowRight" && step < steps.length - 1) setStep(step + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const s = steps[step];
  const last = step === steps.length - 1;
  const Icon = s.icon;

  const advance = () => {
    if (!last) return setStep(step + 1);
    close("completed");
  };

  const followCta = () => {
    const to = s.cta?.to;
    close("completed");
    if (to) navigate(to);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55"
            onClick={() => close("skipped")}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-[16vh] z-50 mx-auto max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="Welcome tour"
          >
            <div ref={panelRef} tabIndex={-1} className="panel-float overflow-hidden rounded-2xl shadow-2xl outline-none">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="font-mono text-micro uppercase tracking-[0.14em] text-ink-3">
                  {step + 1} / {steps.length}
                </p>
                <button
                  onClick={() => close("skipped")}
                  className="flex size-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label="Skip tour"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                  >
                    <span
                      className={cn(
                        "mb-4 flex size-11 items-center justify-center rounded-xl border",
                        last ? "border-iq/30 bg-iq-soft text-iq-ink" : "border-accent/30 bg-accent-soft text-accent-ink",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <p className="eyebrow mb-1.5">{s.eyebrow}</p>
                    <h2 className="text-xl font-bold leading-snug text-ink">{s.title}</h2>
                    <p className="mt-2 text-ui leading-relaxed text-ink-2">{s.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
                <div className="flex items-center gap-1.5" aria-hidden>
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      tabIndex={-1}
                      className={cn(
                        "h-1.5 rounded-full transition-[width,background-color] duration-200",
                        i === step ? "w-5 bg-accent" : "w-1.5 bg-line-strong hover:bg-ink-3",
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {s.cta?.to && (
                    <button
                      onClick={followCta}
                      className="rounded-full border border-line px-3.5 py-2 text-caption font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {s.cta.label}
                    </button>
                  )}
                  <button
                    onClick={s.cta && !s.cta.to ? followCta : advance}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-caption font-semibold text-[#04110c] transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    {last ? (s.cta?.label ?? "Done") : "Next"}
                    {!last && <ArrowRight className="size-3.5" aria-hidden />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
