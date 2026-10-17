import type { SupabaseClient } from "@supabase/supabase-js";
import { authConfigured, config } from "@/lib/config";

/**
 * Lazy, optional Supabase browser client. The SDK is dynamically imported so
 * deployments without auth configured ship zero Supabase bytes to users.
 * Everything auth-related must tolerate `null` — guest/demo mode is the
 * first-class default, not an error state.
 */

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** Whether something already asked for the client (session restore or an auth action). */
export function supabaseRequested(): boolean {
  return clientPromise !== null;
}

/**
 * Should this visit pay for the ~55 KB (brotli) SDK? Only with evidence of a
 * session: a persisted `sb-<ref>-auth-token` key, or an OAuth / magic-link
 * redirect still sitting in the URL. Anonymous visitors get neither, so they
 * never download the SDK and their API calls never wait on it. Pure, for tests.
 */
export function shouldLoadSupabase(storageKeys: Iterable<string>, hash: string, search: string): boolean {
  for (const k of storageKeys) if (/^sb-.+-auth-token/.test(k)) return true;
  // implicit flow (this client's default) lands tokens or errors in the hash
  if (/[#&](access_token|refresh_token|error_description)=/.test(hash)) return true;
  // PKCE code exchange, token-hash links, provider errors
  return /[?&](code|token_hash|error_description)=/.test(search);
}

/** `shouldLoadSupabase` against the live page. */
export function hasAuthEvidence(): boolean {
  if (!authConfigured) return false;
  try {
    return shouldLoadSupabase(Object.keys(localStorage), location.hash, location.search);
  } catch {
    return false; // storage blocked: no persisted session can exist either
  }
}

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!authConfigured) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes the Google OAuth redirect
      },
    }),
  );
  return clientPromise;
}
