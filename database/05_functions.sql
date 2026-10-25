
-- ============================================================
-- FinSight PostgreSQL Functions
-- ============================================================

-- 1. Calculate total expenses for a user in a date range
CREATE OR REPLACE FUNCTION fn_total_expenses(
    p_user_id BIGINT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS NUMERIC(14,2)
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(14,2)
    FROM transactions
    WHERE user_id = p_user_id
      AND transaction_type = 'EXPENSE'
      AND transaction_date BETWEEN p_start_date AND p_end_date;
$$;


-- 2. Calculate total income for a user in a date range
CREATE OR REPLACE FUNCTION fn_total_income(
    p_user_id BIGINT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS NUMERIC(14,2)
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(14,2)
    FROM transactions
    WHERE user_id = p_user_id
      AND transaction_type = 'INCOME'
      AND transaction_date BETWEEN p_start_date AND p_end_date;
$$;


-- 3. Return upcoming pending obligations
CREATE OR REPLACE FUNCTION fn_upcoming_obligations(
    p_user_id BIGINT,
    p_until_date DATE
)
RETURNS TABLE (
    obligation_id BIGINT,
    title VARCHAR(120),
    amount NUMERIC(14,2),
    due_date DATE,
    priority VARCHAR(10)
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        o.obligation_id,
        o.title,
        o.amount,
        o.due_date,
        o.priority
    FROM obligations o
    WHERE o.user_id = p_user_id
      AND o.status = 'PENDING'
      AND o.due_date <= p_until_date
    ORDER BY o.due_date, o.priority DESC;
$$;
