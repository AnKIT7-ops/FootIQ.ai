import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePageMeta } from "@/lib/seo";

/** Google needs an OAuth client in Supabase first; flip VITE_AUTH_GOOGLE=true once it's enabled there. */
const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE === "true";

/** Only same-site paths — `?next=https://evil.example` must not become an open redirect. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/profile";
}

export default function SignIn() {
  usePageMeta({ title: "Sign in", description: "Sign in to FootIQ to sync your follows, saved reports and AI tools.", path: "/signin", noIndex: true });
  const { ready, user, authEnabled, signInWithEmailOtp, signInWithGoogle, signInAsGuest } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "guest" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // A real (non-guest) session has nothing to do here.
  if (ready && user && !user.isAnonymous) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setNotice({ ok: false, text: "Enter a valid email address." });
      return;
    }
    setBusy("email");
    const r = await signInWithEmailOtp(email.trim());
    setBusy(null);
    setNotice({ ok: r.sent, text: r.message });
  };

  const guest = async () => {
    setBusy("guest");
    await signInAsGuest();
    setBusy(null);
    navigate(next, { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
      <p className="eyebrow">Your FootIQ</p>
      <h1 className="display mt-1 text-3xl font-black text-ink">Sign in</h1>
      <p className="mt-2 text-ui text-ink-2">Keep your followed clubs, saved reports and AI tools with you on every device.</p>

      <Card className="mt-6 p-5 md:p-6">
        {!authEnabled ? (
          <p className="text-ui text-ink-2" role="status">
            Sign-in isn't enabled on this deployment yet. Everything still works — your follows are saved on this device.
          </p>
        ) : (
          <div className="space-y-4">
            <form onSubmit={submit} className="space-y-3" noValidate>
              <label htmlFor="signin-email" className="block text-label font-medium text-ink-2">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-ui font-semibold text-[#04110c] transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
              >
                {busy === "email" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                Email me a sign-in link
              </button>
            </form>

            {notice && (
              <p className={notice.ok ? "text-caption text-accent-ink" : "text-caption text-bad"} role="status" aria-live="polite">
                {notice.text}
              </p>
            )}

            {(googleEnabled || !user) && (
            <div className="flex items-center gap-3 text-micro uppercase tracking-wider text-ink-3" aria-hidden>
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            )}

            {googleEnabled && (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface text-ui font-semibold text-ink transition-colors hover:border-line-strong"
              >
                Continue with Google
              </button>
            )}

            {!user && (
              <button
                type="button"
                onClick={() => void guest()}
                disabled={busy !== null}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface text-ui font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
              >
                {busy === "guest" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <UserRound className="size-4" aria-hidden />}
                Continue as guest
              </button>
            )}
            {user?.isAnonymous && (
              <p className="text-caption text-ink-3">
                You're browsing as a guest — guest data stays on this device. Sign in with email to use FootIQ across devices.
              </p>
            )}
          </div>
        )}
      </Card>
      <p className="mt-4 text-caption text-ink-3">
        No password needed — we email you a one-time link. By continuing you accept the <Link to="/terms" className="underline hover:text-ink">Terms</Link> and{" "}
        <Link to="/privacy" className="underline hover:text-ink">Privacy Policy</Link>.
      </p>
    </div>
  );
}
