/**
 * Frontend runtime configuration. Only VITE_-prefixed variables exist here —
 * they are PUBLIC by definition (baked into the bundle), so this file must
 * never hold secrets. Server secrets live in server/.env; the anon key below
 * is Supabase's publishable key, safe to ship, enforced by RLS.
 */

export const config = {
  /** API origin, e.g. "http://localhost:8787". Empty = backend disabled. */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "",
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "",
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
} as const;

/** Backend reachable in principle (configured) — not a liveness check. */
export const backendConfigured = config.apiUrl.length > 0;

/** Auth available (Supabase project wired up). */
export const authConfigured = config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
