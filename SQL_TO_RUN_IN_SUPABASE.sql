-- ============================================================================
-- SQL TO RUN IN SUPABASE
-- Add document URL columns to driver_applications and create logistics_applications table
-- Run this in Supabase SQL Editor after migration 005_compliance_logistics.sql
-- ============================================================================

-- 1. Add document URL columns to driver_applications
ALTER TABLE driver_applications 
  ADD COLUMN IF NOT EXISTS driver_license_url TEXT,
  ADD COLUMN IF NOT EXISTS insurance_url TEXT,
  ADD COLUMN IF NOT EXISTS mvr_report_url TEXT;

-- 2. Create logistics_applications table
CREATE TABLE IF NOT EXISTS logistics_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  authority_url TEXT NOT NULL,
  insurance_cert_url TEXT NOT NULL,
  w9_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for logistics_applications
CREATE INDEX IF NOT EXISTS idx_logistics_applications_user_id ON logistics_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_logistics_applications_status ON logistics_applications(status);

-- Enable RLS for logistics_applications
ALTER TABLE logistics_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can insert/read own; admin can read all/update status
DROP POLICY IF EXISTS "Logistics applications: user can insert own" ON logistics_applications;
DROP POLICY IF EXISTS "Logistics applications: user can read own" ON logistics_applications;
DROP POLICY IF EXISTS "Logistics applications: admin can read all" ON logistics_applications;
DROP POLICY IF EXISTS "Logistics applications: admin can update" ON logistics_applications;

CREATE POLICY "Logistics applications: user can insert own" ON logistics_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Logistics applications: user can read own" ON logistics_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Logistics applications: admin can read all" ON logistics_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Logistics applications: admin can update" ON logistics_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_logistics_applications_updated_at ON logistics_applications;
CREATE TRIGGER update_logistics_applications_updated_at
  BEFORE UPDATE ON logistics_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
