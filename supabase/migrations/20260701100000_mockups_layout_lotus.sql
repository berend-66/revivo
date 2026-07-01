-- Add 'lotus' to the layout_variant CHECK constraint on mockups.
-- Run via: Supabase Dashboard → SQL Editor, or supabase db push.

ALTER TABLE mockups
  DROP CONSTRAINT mockups_layout_variant_check;

ALTER TABLE mockups
  ADD CONSTRAINT mockups_layout_variant_check
  CHECK (layout_variant IN ('atelier', 'studio', 'neon', 'lotus'));
