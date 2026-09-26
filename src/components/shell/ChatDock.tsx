import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Send, Sparkles, X } from "lucide-react";
import type { AiResult } from "@shared/contracts";
import { api, ApiRequestError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { AiText } from "@/components/ui/AiText";
import { DemoEngineChip } from "@/components/ui/DemoEngineChip";
import { cn } from "@/lib/utils";

interface Msg {
  from: "you" | "iq";
  text: string;
  /** Who wrote an answer: a real provider, or "script" for the local engine. Unset on the greeting. */
  provider?: string;
  /** Why a signed-in question fell back to the script (quota, outage). */
  note?: string;
}

/** The answer engine ships with the data bundle — pulled in on first open, not at boot. */
type AnswerFn = (q: string) => string;
let answerFn: AnswerFn | null = null;
async function loadAnswerEngine(): Promise<AnswerFn> {
  if (!answerFn) {
    const mod = await import("@/lib/concierge");
    answerFn = mod.answer;
  }
  return answerFn;
}

const starters = ["How good is Yamal?", "Predict City vs Chelsea", "Who should I captain?", "Arsenal form"];

export function ChatDock() {
  const { authEnabled, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "iq", text: "Evening. Matchday is live — ask me about any player, fixture, transfer or fantasy call." },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking, open]);

  useEffect(() => {
    if (!open) return;
    // warm the engine while the user types their first question
    void loadAnswerEngine();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setMsgs((m) => [...m, { from: "you", text: t }]);
    setDraft("");
    setThinking(true);
    const minDelay = new Promise((r) => setTimeout(r, 650));
    const scripted = (note?: string): Promise<Msg> =>
      loadAnswerEngine().then((fn) => ({ from: "iq", text: fn(t), provider: "script", note }));
    // Signed in → the real model (metered, so it needs an account). Any failure
    // falls back to the script, which the chip then labels as the demo engine.
    const reply: Promise<Msg> = user
      ? api.post<AiResult>("/api/ai/ask", { question: t }).then(
          (r) => ({ from: "iq", text: r.text, provider: r.provider }),
          (err) => scripted(err instanceof ApiRequestError ? err.message : "The AI model didn't answer."),
        )
      : scripted();
    void Promise.all([reply, minDelay]).then(([msg]) => {
      setMsgs((m) => [...m, msg]);
      setThinking(false);
    });
  };

  return (
    <>
      <motion.button
        ref={toggleRef}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-40 flex size-13 items-center justify-center rounded-full border border-iq/30 bg-surface shadow-2xl lg:bottom-6 lg:right-6"
        style={{ boxShadow: "var(--glow-iq)" }}
        aria-label={open ? "Close FootIQ assistant" : "Open FootIQ assistant"}
        aria-expanded={open}
      >
        {open ? <X className="size-5 text-iq-ink" aria-hidden /> : <Sparkles className="size-5 text-iq-ink" aria-hidden />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="glass fixed bottom-36 right-4 z-40 flex h-[26rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl shadow-2xl lg:bottom-22 lg:right-6"
            role="dialog"
            aria-label="FootIQ AI assistant"
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Sparkles className="size-4 text-iq-ink" aria-hidden />
              <p className="font-mono text-label font-semibold uppercase tracking-[0.14em] text-iq-ink">FootIQ Concierge</p>
              <span className="ml-auto font-mono text-micro uppercase tracking-wider text-ink-3">algorithmically generated</span>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-ui leading-relaxed",
                      m.from === "you" ? "rounded-br-md bg-accent-soft text-ink" : "rounded-bl-md border border-iq/20 bg-iq-soft text-ink",
                    )}
                  >
                    {m.from === "iq" ? <AiText text={m.text} /> : m.text}
                    {m.note && <p className="mt-2 text-caption text-ink-3">{m.note}</p>}
                    {m.provider !== undefined && <DemoEngineChip provider={m.provider} className="mt-2" />}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-iq/20 bg-iq-soft px-4 py-3" aria-label="Assistant is thinking">
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="size-1.5 rounded-full bg-iq"
                          animate={{ opacity: [0.25, 1, 0.25] }}
                          transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.18 }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              {msgs.length === 1 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-iq/40 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                  {authEnabled && !user && (
                    <Link
                      to={`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                      className="basis-full pt-1 text-caption text-ink-3 underline decoration-iq/40 underline-offset-2 hover:text-ink"
                    >
                      Sign in for answers from the AI model — it's free.
                    </Link>
                  )}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-center gap-2 border-t border-line p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about anything in football…"
                className="h-10 flex-1 rounded-xl border border-line bg-surface px-3.5 text-ui text-ink outline-none placeholder:text-ink-3 focus:border-iq/40"
                aria-label="Message the assistant"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="flex size-10 items-center justify-center rounded-xl bg-iq text-[#241a02] transition-opacity disabled:opacity-35"
                aria-label="Send message"
              >
                <Send className="size-4" aria-hidden />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
