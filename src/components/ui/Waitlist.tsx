import { useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidEmail, waitlist } from "@/lib/waitlist";
import { track } from "@/lib/analytics";
import { bump } from "@/lib/metrics";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Email capture form with validation + loading/success/error states.
 * Storage goes through the waitlist provider abstraction (local for the beta).
 */
export function WaitlistForm({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    const value = email.trim();

    if (!isValidEmail(value)) {
      setStatus("error");
      setMessage("Enter a valid email address, e.g. you@club.com");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const already = await waitlist.has(value);
      await waitlist.join(value);
      setStatus("success");
      setMessage(already ? "You're already on the list — we've got you." : "You're in. We'll email you when live data lands.");
      track("newsletter_signup");
      bump("newsletter", "signup");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className={cn("flex items-center gap-2.5 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3", className)} role="status">
        <CheckCircle2 className="size-5 shrink-0 text-accent-ink" aria-hidden />
        <p className="text-[13.5px] font-medium text-ink">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={className}>
      <div className={cn("flex gap-2", compact ? "flex-row" : "flex-col sm:flex-row")}>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Email address</span>
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") {
                setStatus("idle");
                setMessage("");
              }
            }}
            placeholder="you@club.com"
            autoComplete="email"
            inputMode="email"
            aria-invalid={status === "error"}
            aria-describedby={message ? "waitlist-message" : undefined}
            className={cn(
              "h-11 w-full rounded-2xl border bg-surface pl-10 pr-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3",
              status === "error" ? "border-bad/60 focus:border-bad" : "border-line focus:border-accent",
            )}
          />
        </label>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[13.5px] font-semibold text-[#04110c] transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Joining…
            </>
          ) : (
            "Join the waitlist"
          )}
        </button>
      </div>
      <div aria-live="polite">
        {message && status === "error" && (
          <p id="waitlist-message" className="mt-2 text-[12.5px] font-medium text-bad">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
