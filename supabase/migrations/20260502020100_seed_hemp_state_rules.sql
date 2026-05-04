-- ============================================================================
-- Seed hemp_state_rules with all 51 US jurisdictions (50 states + DC).
--
-- Note: ALTER COLUMN DROP NOT NULL on the four boolean columns was applied
-- manually in production before this migration. This file only seeds data.
--
-- Default posture (all states unless overridden):
--   allows_sale_non_intoxicating    = true   (CBD/wellness — generally legal)
--   allows_delivery_non_intoxicating = true
--   allows_sale_intoxicating        = NULL   (unknown — show advisory)
--   allows_delivery_intoxicating    = NULL
--   notes = 'Pending legal review. Consult licensed counsel.'
--
-- Conservative overrides for 6 states with widely-reported restrictions
-- on intoxicating hemp as of late 2025. These use allows_sale_intoxicating=false.
-- HEMP ATTORNEY REVIEW REQUIRED before treating any row as legal advice.
--
-- ON CONFLICT DO NOTHING keeps this idempotent / safe to re-run.
-- ============================================================================

insert into public.hemp_state_rules (
  state_code,
  allows_sale_non_intoxicating,
  allows_delivery_non_intoxicating,
  allows_sale_intoxicating,
  allows_delivery_intoxicating,
  notes,
  sources
) values
  ('AL', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('AK', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('AZ', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('AR', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('CA', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('CO', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('CT', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('DE', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('DC', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('FL', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('GA', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('HI', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('IL', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('IN', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('KY', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('ME', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('MD', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('MA', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('MI', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('MN', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('MO', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('MT', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NE', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NV', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NH', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NJ', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NM', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NY', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('NC', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('ND', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('OH', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('OK', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('OR', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('PA', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('RI', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('SC', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('TN', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('TX', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('UT', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('VT', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('VA', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('WA', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('WV', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('WI', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  ('WY', true, true, null, null, 'Pending legal review. Consult licensed counsel.', '[]'),
  -- Conservative overrides: widely reported restrictions on intoxicating hemp as of late 2025.
  -- HEMP ATTORNEY REVIEW REQUIRED before relying on these in production.
  ('ID', true, true, false, false,
   'Idaho prohibits THC including delta-8/9. Hemp must contain 0.0% THC. Verify with licensed counsel.',
   '[]'),
  ('KS', true, true, false, false,
   'Kansas restricts intoxicating hemp. Verify current law with licensed counsel.',
   '[]'),
  ('SD', true, true, false, false,
   'South Dakota restricts intoxicating hemp products. Verify with licensed counsel.',
   '[]'),
  ('IA', true, true, false, false,
   'Iowa restricts intoxicating hemp. Verify with licensed counsel.',
   '[]'),
  ('MS', true, true, false, false,
   'Mississippi restricts recreational intoxicating hemp. Verify with licensed counsel.',
   '[]'),
  ('LA', true, true, false, false,
   'Louisiana heavily regulates intoxicating hemp products. Specific licensing required. Verify with licensed counsel.',
   '[]')
on conflict (state_code) do nothing;
