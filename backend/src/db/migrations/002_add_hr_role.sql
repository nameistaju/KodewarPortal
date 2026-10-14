-- Migration: Add HR Role to KODEWAR Workforce Portal
-- Version: 002
-- Description: Non-destructive, additive reference migration documenting HR role enablement.
-- Note: employees.role in Supabase Postgres is stored as lowercase text/varchar ('admin', 'employee', 'hr').

-- 1. If a check constraint exists on employees.role, update it to include 'hr':
DO $$
BEGIN
  -- Drop legacy check constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'employees_role_check'
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_role_check;
  END IF;

  -- Add updated check constraint supporting admin, employee, and hr
  ALTER TABLE employees 
    ADD CONSTRAINT employees_role_check 
    CHECK (LOWER(role) IN ('admin', 'employee', 'hr'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table employees does not exist yet; skipping constraint update.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped or not applicable: %', SQLERRM;
END $$;

-- 2. Optional index on (role, is_active) for high-performance role-based filtering
CREATE INDEX IF NOT EXISTS idx_employees_role_active ON employees(role, is_active);
