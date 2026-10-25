-- ============================================================
-- FinSight Database Setup & Verification
-- PostgreSQL 16
-- ============================================================

-- Verify current database
SELECT current_database() AS database_name;

-- Verify current user
SELECT current_user AS database_user;

-- Verify current schema
SELECT current_schema() AS schema_name;

-- Verify PostgreSQL version
SELECT version();