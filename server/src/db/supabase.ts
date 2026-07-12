import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasDatabase, type Env } from "../config/env";

/**
 * Server-side Supabase client (service role). Bypasses RLS by design, so it
 * NEVER touches a request without the service scoping queries by user id.
 * Returns null when unconfigured — callers must degrade gracefully.
 */
export function createServiceClient(env: Env): SupabaseClient | null {
  if (!hasDatabase(env)) return null;
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "footiq-api" } },
  });
}
