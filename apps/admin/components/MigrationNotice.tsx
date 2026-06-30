/** Shown when a new table (deals / lead_events) isn't in the DB yet — the 3
 * migrations 20260629* haven't been applied to this Supabase project. Pure markup. */
export function MigrationNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="notice small">
        Deals-tabellen nog niet aangemaakt — pas de migraties <span className="mono">20260629*</span> toe.
      </div>
    );
  }
  return (
    <div className="notice">
      <strong>Migraties nog niet toegepast.</strong> De tabellen <span className="mono">deals</span> en{" "}
      <span className="mono">lead_events</span> bestaan nog niet in dit Supabase-project. Pas de drie migraties
      <span className="mono"> supabase/migrations/20260629*</span> toe — push naar <span className="mono">main</span>{" "}
      (de GitHub Action draait <span className="mono">supabase db push</span>) of plak ze in de Supabase SQL-editor.
      Daarna verschijnen de funnel-omzet en de deals-pipeline vanzelf.
    </div>
  );
}
