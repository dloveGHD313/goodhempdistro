-- Phase 3C: admin_note on product_documents for COA reject reason
ALTER TABLE public.product_documents
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

COMMENT ON COLUMN public.product_documents.admin_note IS 'Optional admin note when COA status is rejected (Phase 3C).';
