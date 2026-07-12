import type { SupabaseClient } from "@supabase/supabase-js";
import { authConfigured, config } from "@/lib/config";

/**
 * Lazy, optional Supabase browser client. The SDK is dynamically imported so
 * deployments without auth configured ship zero Supabase bytes to users.
 * Everything auth-related must tolerate `null` — guest/demo mode is the
 * first-class default, not an error state.
 */

let clientPromise: Promise<SupabaseClient | null> | null = null;

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
