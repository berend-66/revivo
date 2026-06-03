import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseSettings, requireSupabaseSettings, type SupabaseSettings } from "./config";

/**
 * A Supabase client authenticated with the SERVICE ROLE key. Server-side only.
 * No session persistence / token refresh — this is a stateless server actor, not
 * a logged-in user.
 */
export function createServiceClient(settings: SupabaseSettings = requireSupabaseSettings()): SupabaseClient {
  return createClient(settings.url, settings.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service client, or `null` when Supabase isn't configured — for dual-source
 * callers (the mock app) that fall back to local files. */
export function createServiceClientOrNull(env: NodeJS.ProcessEnv = process.env): SupabaseClient | null {
  const settings = loadSupabaseSettings(env);
  return settings ? createServiceClient(settings) : null;
}
