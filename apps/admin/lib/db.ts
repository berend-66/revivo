import "server-only";
import { createServiceClient, type SupabaseClient } from "@revivo/db";

/**
 * The single service-role Supabase handle for the admin app. The service-role key
 * bypasses RLS, so this module is SERVER-ONLY — the `import "server-only"` above
 * turns any accidental Client Component import into a build error. Every page is a
 * Server Component and every mutation a Server Action; neither ships the key.
 *
 * Lazy + cached: createServiceClient() throws when SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY are unset, so we only construct on first real use
 * (pages are force-dynamic — no build-time DB access).
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!cached) cached = createServiceClient();
  return cached;
}
