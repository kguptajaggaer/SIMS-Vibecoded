-- Fix: Grant permissions to anon and authenticated roles for contract_documents
-- Run in: https://supabase.com/dashboard/project/tcldbeieywjpuaipalpq/sql

GRANT SELECT, INSERT, UPDATE, DELETE ON contract_documents TO anon, authenticated;

-- Also ensure RLS policy is correct (drop and recreate if needed)
DROP POLICY IF EXISTS "allow_all_contract_documents" ON contract_documents;
CREATE POLICY "allow_all_contract_documents"
  ON contract_documents
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Verify: check grant was applied
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'contract_documents';
