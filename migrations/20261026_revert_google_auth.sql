-- Migration: Revert Google Auth Specific Schema Changes Safely
-- Pre-condition: All existing users possess valid password_hash

BEGIN;

-- 1. Restore password_hash to NOT NULL (all existing users verified to have valid bcrypt hashes)
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- 2. Drop unique constraint on google_id if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_google_id'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT uq_users_google_id;
  END IF;
END $$;

-- 3. Drop google_id column if present
ALTER TABLE users DROP COLUMN IF EXISTS google_id;

-- 4. Drop profile_picture column if present
ALTER TABLE users DROP COLUMN IF EXISTS profile_picture;

-- 5. Drop is_profile_complete column if present
ALTER TABLE users DROP COLUMN IF EXISTS is_profile_complete;

COMMIT;
