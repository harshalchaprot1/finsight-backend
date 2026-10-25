-- Migration: Add Google Auth Support and Profile Completion Tracking
-- Preserves existing users and financial data integrity

BEGIN;

-- 1. Add google_id column with unique constraint
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_google_id'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT uq_users_google_id UNIQUE (google_id);
  END IF;
END $$;

-- 2. Add profile_picture column for optional Google avatar
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- 3. Add is_profile_complete column to track whether onboarding is done
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Make password_hash nullable so Google-only accounts do not require a dummy or plaintext password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 5. Mark existing active users as having profile complete if they already have profile_type set
UPDATE users
SET is_profile_complete = TRUE
WHERE profile_type IS NOT NULL
  AND is_profile_complete = FALSE;

COMMIT;
