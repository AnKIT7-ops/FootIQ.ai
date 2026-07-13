import { useState } from "react";
import { Bug, CheckCircle2, Lightbulb, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "@/lib/api/client";
import { backendConfigured } from "@/lib/config";
import { track } from "@/lib/analytics";
import { bump } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/**
 * Lightweight product feedback, two shapes:
 *  - FeedbackWidget: 👍/👎 on any AI block (embedded by AIMeta so every AI
 *    surface gets it for free). 👎 opens an optional "what was off?" note.
 *  - FeedbackForm: the full category form on /contact.
 * Both post to the existing /api/feedback (rate-limited, PII-optional) and
 * degrade to local-only counting when no backend is configured.
 */

function sendFeedback(category: "general" | "bug" | "data" | "ai", message: string): Promise<unknown> {
  bump("ai_use", `feedback:${category}`);
  track("feedback_submitted", { category });
  if (!backendConfigured) return Promise.resolve();
  return api.post("/api/feedback", { category, message: message.slice(0, 4000), page: window.location.pathname });
}

export function FeedbackWidget({ subject = "AI analysis", className }: { subject?: string; className?: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const submit = (v: "up" | "down", extra?: string) => {
    setVote(v);
    if (v === "down" && extra === undefined) return; // wait for the optional note
    setDone(true);
    void sendFeedback("ai", `[${v === "up" ? "helpful" : "not helpful"}] ${subject}${extra ? ` — ${extra}` : ""}`).catch(() => {});
  };

  if (done) {
    return (
      <p className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3", className)} role="status">
        <CheckCircle2 className="size-3.5 text-accent-ink" aria-hidden /> Thanks — this tunes future analysis.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">Was this helpful?</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => submit("up", "")}
          className="flex size-7 items-center justify-center rounded-full border border-line text-ink-3 transition-colors hover:border-accent/50 hover:text-accent-ink"
          aria-label={`${subject}: helpful`}
        >
          <ThumbsUp className="size-3.5" aria-hidden />
        </button>
        <button
          onClick={() => submit("down")}
          className={cn(
            "flex size-7 items-center justify-center rounded-full border transition-colors",
            vote === "down" ? "border-bad/50 text-bad" : "border-line text-ink-3 hover:border-bad/50 hover:text-bad",
          )}
          aria-label={`${subject}: not helpful`}
        >
          <ThumbsDown className="size-3.5" aria-hidden />
        </button>
      </div>
      {vote === "down" && (
        <form
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit("down", note.trim());
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">What was off? (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was off? (optional)"
              maxLength={280}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="h-7 w-full min-w-32 rounded-full border border-line bg-surface px-3 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="h-7 shrink-0 rounded-full bg-accent px-3 text-[11.5px] font-semibold text-[#04110c] transition-transform hover:scale-[1.03] active:scale-95"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}

const categories = [
  { id: "general" as const, label: "Idea / feedback", icon: Lightbulb },
  { id: "bug" as const, label: "Bug report", icon: Bug },
  { id: "data" as const, label: "Wrong data", icon: Bug },
  { id: "ai" as const, label: "AI quality", icon: ThumbsDown },
];

export function FeedbackForm({ className }: { className?: string }) {
  const [category, setCategory] = useState<(typeof categories)[number]["id"]>("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 3 || status === "loading") return;
    if (!backendConfigured) {
      // demo mode: hand off to the mail client instead of silently dropping it
      window.location.href = `mailto:hello@footiq.ai?subject=${encodeURIComponent(`FootIQ ${category} feedback`)}&body=${encodeURIComponent(text)}`;
      return;
    }
    setStatus("loading");
    try {
      await sendFeedback(category, text);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className={cn("flex items-center gap-2.5 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3", className)} role="status">
        <CheckCircle2 className="size-5 shrink-0 text-accent-ink" aria-hidden />
        <p className="text-[13.5px] font-medium text-ink">Received — beta feedback directly shapes the roadmap. Thank you.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Feedback category">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              category === c.id
                ? "border-accent/50 bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            <c.icon className="size-3.5" aria-hidden />
            {c.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="sr-only">Your feedback</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={
            category === "bug"
              ? "What broke? Include the page, your device and what you expected to happen."
              : "What's confusing, what's missing, what would make FootIQ indispensable?"
          }
          className="w-full rounded-2xl border border-line bg-surface p-3.5 text-[13.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={message.trim().length < 3 || status === "loading"}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-[#04110c] transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            "Send feedback"
          )}
        </button>
        {status === "error" && (
          <p className="text-[12.5px] font-medium text-bad" role="alert">
            Couldn't send — please try again or email hello@footiq.ai.
          </p>
        )}
      </div>
    </form>
  );
}
