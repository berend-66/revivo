/**
 * Tolerate a not-yet-applied migration. The admin (Vercel) and the SQL migrations
 * (the GitHub Action `supabase db push`) deploy on INDEPENDENT pipelines triggered
 * by the same push to main — they can finish in either order, so on a first deploy
 * the app can be live for a few minutes before a new table exists. Rather than
 * 500 a whole page, reads of the new tables degrade to this PENDING sentinel and
 * the page renders a "apply migrations" banner instead.
 *
 * Only the specific "relation/table missing" error is swallowed; any other failure
 * still throws (we don't want to hide real bugs behind a setup banner).
 */
export const PENDING_MIGRATION = Symbol("pending-migration");

export async function tolerant<T>(p: Promise<T>): Promise<T | typeof PENDING_MIGRATION> {
  try {
    return await p;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Could not find the table|schema cache|does not exist|relation .* does not exist/i.test(msg)) {
      return PENDING_MIGRATION;
    }
    throw e;
  }
}

export function isPending<T>(v: T | typeof PENDING_MIGRATION): v is typeof PENDING_MIGRATION {
  return v === PENDING_MIGRATION;
}
