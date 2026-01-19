-- ============================================================================
-- Vendor Approval Flow Migration
-- ============================================================================

-- Create vendor_applications table
CREATE TABLE IF NOT EXISTS vendor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_applications_user_id ON vendor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_status ON vendor_applications(status);

-- Enable RLS
ALTER TABLE vendor_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Vendor applications: user can insert/read own" ON vendor_applications;
DROP POLICY IF EXISTS "Vendor applications: admin can read all" ON vendor_applications;
DROP POLICY IF EXISTS "Vendor applications: admin can update all" ON vendor_applications;

CREATE POLICY "Vendor applications: user can insert/read own" ON vendor_applications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vendor applications: admin can read all" ON vendor_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Vendor applications: admin can update all" ON vendor_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_vendor_applications_updated_at ON vendor_applications;
CREATE TRIGGER update_vendor_applications_updated_at
  BEFORE UPDATE ON vendor_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure profiles.role column exists (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT;
  END IF;
END $$;
