/**
 * Supabase configuration. The service-role key is server-side ONLY — it bypasses
 * RLS, so it must never reach a browser bundle. The mock app reads it in SSR
 * frontmatter (server) and the generator CLI uses it from Node; neither ships it
 * to the client.
 */

export interface SupabaseSettings {
  url: string;
  serviceRoleKey: string;
}

/** Returns settings, or `null` when Supabase isn't configured (so callers can
 * fall back to local files instead of crashing). Use `requireSupabaseSettings`
 * when a sink is mandatory (e.g. `--push`). */
export function loadSupabaseSettings(env: NodeJS.ProcessEnv = process.env): SupabaseSettings | null {
  const url = env.SUPABASE_URL ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function requireSupabaseSettings(env: NodeJS.ProcessEnv = process.env): SupabaseSettings {
  const settings = loadSupabaseSettings(env);
  if (!settings) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env " +
        "(Supabase dashboard → Project Settings → API), and apply the migration (see supabase/README.md).",
    );
  }
  return settings;
}
