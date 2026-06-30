export * from "./config";
export * from "./client";
export * from "./mockups";
export * from "./leads";
export * from "./jobs";
export * from "./lead-events";
export * from "./deals";
// Consumers type their handles via this package, not via a direct
// @supabase/supabase-js dependency — the db layer owns that boundary.
export type { SupabaseClient } from "@supabase/supabase-js";
