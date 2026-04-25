CREATE TABLE IF NOT EXISTS wholesale_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  category text,
  volume text,
  message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wholesale_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON wholesale_inquiries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin read" ON wholesale_inquiries
  FOR SELECT USING (auth.role() = 'service_role');
