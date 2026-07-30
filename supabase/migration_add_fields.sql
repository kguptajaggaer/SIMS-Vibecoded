-- ─── Run this in Supabase SQL Editor ─────────────────────────────────────────
-- Project: https://supabase.com/dashboard/project/tcldbeieywjpuaipalpq/sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add email and phone to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 2. Add new fields to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(255);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS supplier_contact_email VARCHAR(255);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS cmc VARCHAR(255);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS subcontract_amount NUMERIC(18,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS report_type VARCHAR(100);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS mb_goal_pct NUMERIC(5,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS mb_goal_amount NUMERIC(18,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS wb_goal_pct NUMERIC(5,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS wb_goal_amount NUMERIC(18,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sb_goal_pct NUMERIC(5,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sb_goal_amount NUMERIC(18,2);

-- 3. Create contract_documents table for attachments
CREATE TABLE IF NOT EXISTS contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL DEFAULT 1,
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL DEFAULT '',
  description TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS on contract_documents
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_contract_documents"
  ON contract_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Create Supabase Storage bucket for contract documents
-- Note: Run this in the Supabase dashboard → Storage → New bucket
-- Name: contract-documents, Public: true
-- Or use the SQL below (requires pg_storage extension):
-- SELECT storage.create_bucket('contract-documents', true);
