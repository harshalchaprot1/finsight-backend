
-- ============================================================
-- FinSight: Development Cleanup Script
-- WARNING: Running this script deletes FinSight database data.
-- Keep the statements commented until a reset is necessary.
-- ============================================================

-- Uncomment only when you intentionally want to reset the schema.

-- BEGIN;

-- DROP VIEW IF EXISTS v_budget_status;
-- DROP VIEW IF EXISTS v_monthly_financial_summary;
-- DROP VIEW IF EXISTS v_account_balances;

-- DROP FUNCTION IF EXISTS fn_total_expenses(BIGINT, DATE, DATE);
-- DROP FUNCTION IF EXISTS fn_total_income(BIGINT, DATE, DATE);
-- DROP FUNCTION IF EXISTS fn_upcoming_obligations(BIGINT, DATE);

-- DROP TABLE IF EXISTS password_reset_tokens CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS obligations CASCADE;
-- DROP TABLE IF EXISTS budgets CASCADE;
-- DROP TABLE IF EXISTS merchants CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS accounts CASCADE;
-- DROP TABLE IF EXISTS payment_methods CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- COMMIT;
