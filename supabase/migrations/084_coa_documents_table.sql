-- ============================================================================
-- Phase 2 COA: product_documents table for isolated COA storage
-- COA upload must never block product creation; documents are optional per product.
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'coa' CHECK (type IN ('coa')),
  storage_bucket TEXT NOT NULL DEFAULT 'coas',
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, type)
);

CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_owner_user_id ON product_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_status ON product_documents(status);

ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;

-- Vendor can INSERT only for their own products (owner_user_id = auth.uid())
DROP POLICY IF EXISTS "product_documents: vendor insert own" ON product_documents;
CREATE POLICY "product_documents: vendor insert own" ON product_documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

-- Vendor can SELECT/UPDATE/DELETE only their own documents
DROP POLICY IF EXISTS "product_documents: vendor select own" ON product_documents;
CREATE POLICY "product_documents: vendor select own" ON product_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "product_documents: vendor update own" ON product_documents;
CREATE POLICY "product_documents: vendor update own" ON product_documents
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "product_documents: vendor delete own" ON product_documents;
CREATE POLICY "product_documents: vendor delete own" ON product_documents
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

-- Admin can do all
DROP POLICY IF EXISTS "product_documents: admin all" ON product_documents;
CREATE POLICY "product_documents: admin all" ON product_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS update_product_documents_updated_at ON product_documents;
CREATE TRIGGER update_product_documents_updated_at
  BEFORE UPDATE ON product_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
