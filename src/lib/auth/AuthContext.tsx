import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionUser } from "@shared/contracts";
import { authConfigured } from "@/lib/config";
import { getSupabase } from "./supabase";
import { registerAuthTokenGetter } from "@/lib/api/client";

/**
 * Session state for the whole app.
 *
 * Three modes, all first-class:
 *   demo   — Supabase not configured; everyone is a guest, nothing breaks.
 *   guest  — configured, signed out (or signed in anonymously).
 *   user   — email OTP or Google OAuth session; persists across reloads.
 *
 * The API client gets its bearer token from here (registered getter), so
 * every backend call is authenticated the moment a session exists.
 */

export interface AuthState {
  /** null while the initial session restore is in flight. */
  ready: boolean;
  user: SessionUser | null;
  /** Whether real sign-in is possible on this deployment. */
  authEnabled: boolean;
  signInWithGoogle(): Promise<void>;
  signInWithEmailOtp(email: string): Promise<{ sent: boolean; message: string }>;
  signInAsGuest(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Register the token getter at module scope so even pre-provider API calls
// (repository hydration) pick up a persisted session token.
registerAuthTokenGetter(async () => {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

function mapUser(u: {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): SessionUser {
  const role = u.app_metadata?.role === "admin" ? "admin" : "user";
  const planRaw = u.app_metadata?.plan;
  return {
    id: u.id,
    email: u.email ?? null,
    role,
    plan: planRaw === "pro" || planRaw === "club" ? planRaw : "free",
    displayName: (u.user_metadata?.name as string | undefined) ?? null,
    avatarUrl: (u.user_metadata?.avatar_url as string | undefined) ?? null,
    isAnonymous: u.is_anonymous === true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!authConfigured); // demo mode is ready immediately
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!authConfigured) return;
    let unsubscribe = () => {};
    void getSupabase().then((supabase) => {
      if (!supabase) {
        setReady(true);
        return;
      }
      void supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ? mapUser(data.session.user) : null);
        setReady(true);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ? mapUser(session.user) : null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signInWithEmailOtp = useCallback(async (email: string) => {
    const supabase = await getSupabase();
    if (!supabase) return { sent: false, message: "Sign-in isn't enabled on this deployment yet." };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return error
      ? { sent: false, message: "Couldn't send the sign-in link. Try again shortly." }
      : { sent: true, message: "Check your inbox for a sign-in link." };
  }, []);

  const signInAsGuest = useCallback(async () => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.auth.signInAnonymously();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await getSupabase();
    await supabase?.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      authEnabled: authConfigured,
      signInWithGoogle,
      signInWithEmailOtp,
      signInAsGuest,
      signOut,
    }),
    [ready, user, signInWithGoogle, signInWithEmailOtp, signInAsGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** What to call someone in the UI: their name, else their email's local part, else "Guest". */
export function displayNameOf(user: SessionUser | null): string {
  if (!user) return "Guest";
  return user.displayName?.trim() || user.email?.split("@")[0] || "Guest";
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Route guard. Demo mode (auth not configured) renders children untouched —
 * the demo must keep working with zero env vars. With auth configured, it
 * renders children for any session and the fallback for signed-out visitors.
 */
export function RequireAuth({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { ready, user, authEnabled } = useAuth();
  if (!authEnabled) return <>{children}</>;
  if (!ready) return null; // restoring session — a flash of fallback would be wrong
  return user ? <>{children}</> : <>{fallback}</>;
}
