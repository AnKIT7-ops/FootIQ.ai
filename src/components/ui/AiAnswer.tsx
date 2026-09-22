import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import type { AiResult } from "@shared/contracts";
import { api, ApiRequestError, ApiUnavailableError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { IQInsight } from "./IQInsight";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: AiResult }
  | { kind: "error"; message: string; signIn?: boolean };

function messageFor(err: unknown): { message: string; signIn?: boolean } {
  if (err instanceof ApiUnavailableError) return { message: "AI isn't connected on this deployment." };
  if (err instanceof ApiRequestError) {
    if (err.code === "unauthorized") return { message: "Sign in to use AI answers — it's free.", signIn: true };
    if (err.code === "quota_exceeded" || err.code === "rate_limited") return { message: err.message };
    return { message: err.message };
  }
  return { message: "The AI engine didn't answer. Try again shortly." };
}

/** Tiny renderer for the provider's constrained markdown: paragraphs, "-" bullets, **bold**. */
function AiText({ text }: { text: string }) {
  const bold = (line: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="text-ink">{part.slice(2, -2)}</strong> : part,
    );
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${blocks.length}`} className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-iq" aria-hidden />
              <span>{bold(b)}</span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) bullets.push(line.replace(/^[-*]\s+/, ""));
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`}>{bold(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-2.5">{blocks}</div>;
}

/**
 * On-demand AI answer from one of the API's /api/ai/* endpoints.
 * Nothing is generated until the reader asks (each answer costs quota); the
 * answer renders in the amber IQ panel with the real provider, so the
 * demo-engine chip only appears when the server genuinely used the mock.
 */
export function AiAnswer({ endpoint, title, cta, feedback }: { endpoint: string; title: string; cta: string; feedback?: string }) {
  const { authEnabled, user } = useAuth();
  const [state, setState] = useState<State>({ kind: "idle" });

  // A different fixture/player is a different question.
  useEffect(() => setState({ kind: "idle" }), [endpoint]);

  const ask = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "done", result: await api.post<AiResult>(endpoint) });
    } catch (err) {
      setState({ kind: "error", ...messageFor(err) });
    }
  }, [endpoint]);

  if (state.kind === "done") {
    return (
      <IQInsight title={title} provider={state.result.provider} feedback={feedback}>
        <AiText text={state.result.text} />
      </IQInsight>
    );
  }

  const needsSignIn = authEnabled && !user;
  return (
    <div className="rounded-2xl border border-iq/25 bg-iq-soft p-4">
      <div className="flex flex-wrap items-center gap-3">
        {needsSignIn ? (
          <Link
            to={`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            className="inline-flex items-center gap-2 rounded-full bg-iq px-4 py-2 text-ui font-semibold text-[#241a02] transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Sparkles className="size-4" aria-hidden /> Sign in to {cta.toLowerCase()}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void ask()}
            disabled={state.kind === "loading"}
            className="inline-flex items-center gap-2 rounded-full bg-iq px-4 py-2 text-ui font-semibold text-[#241a02] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60"
          >
            {state.kind === "loading" ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {state.kind === "loading" ? "Thinking…" : cta}
          </button>
        )}
        <span className="text-caption text-ink-3">AI-written from the facts on this page. Free during beta.</span>
      </div>
      {state.kind === "error" && (
        <p className="mt-2.5 text-caption text-ink-2" role="status">
          {state.message}{" "}
          {state.signIn && (
            <Link to="/signin" className="font-semibold text-iq-ink underline">
              Sign in
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
