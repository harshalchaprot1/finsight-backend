
-- ============================================================
-- FinSight Views
-- PostgreSQL 16
-- ============================================================

-- 1. Account balances based on opening balance and transactions
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
    a.user_id,
    a.account_id,
    a.account_name,
    a.account_type,
    a.opening_balance
    + COALESCE(
        SUM(
            CASE
                WHEN t.transaction_type IN ('INCOME', 'REFUND')
                    THEN t.amount
                WHEN t.transaction_type = 'EXPENSE'
                    THEN -t.amount
                WHEN t.transaction_type = 'TRANSFER'
                    THEN -t.amount
                ELSE 0
            END
        ), 0
      )
    + COALESCE(
        (
            SELECT SUM(t2.amount)
            FROM transactions t2
            WHERE t2.to_account_id = a.account_id
              AND t2.user_id = a.user_id
              AND t2.transaction_type = 'TRANSFER'
        ), 0
      ) AS current_balance
FROM accounts a
LEFT JOIN transactions t
    ON t.account_id = a.account_id
   AND t.user_id = a.user_id
GROUP BY
    a.user_id,
    a.account_id,
    a.account_name,
    a.account_type,
    a.opening_balance;


-- 2. Monthly income, expenses, refunds, and net cash flow
CREATE OR REPLACE VIEW v_monthly_financial_summary AS
SELECT
    user_id,
    DATE_TRUNC('month', transaction_date)::DATE AS month,
    SUM(amount) FILTER (
        WHERE transaction_type = 'INCOME'
    ) AS total_income,
    SUM(amount) FILTER (
        WHERE transaction_type = 'EXPENSE'
    ) AS total_expenses,
    SUM(amount) FILTER (
        WHERE transaction_type = 'REFUND'
    ) AS total_refunds,
    SUM(
        CASE
            WHEN transaction_type = 'INCOME' THEN amount
            WHEN transaction_type = 'REFUND' THEN amount
            WHEN transaction_type = 'EXPENSE' THEN -amount
            ELSE 0
        END
    ) AS net_cash_flow
FROM transactions
GROUP BY
    user_id,
    DATE_TRUNC('month', transaction_date)::DATE;


-- 3. Budget limits compared with actual category spending
CREATE OR REPLACE VIEW v_budget_status AS
SELECT
    b.user_id,
    b.budget_id,
    c.category_name,
    b.month_start,
    b.month_end,
    b.monthly_limit,
    COALESCE(SUM(t.amount), 0) AS actual_spending,
    b.monthly_limit - COALESCE(SUM(t.amount), 0) AS remaining_budget,
    ROUND(
        COALESCE(SUM(t.amount), 0) * 100.0
        / NULLIF(b.monthly_limit, 0),
        2
    ) AS utilization_percentage
FROM budgets b
JOIN categories c
    ON c.category_id = b.category_id
   AND c.user_id = b.user_id
LEFT JOIN transactions t
    ON t.user_id = b.user_id
   AND t.category_id = b.category_id
   AND t.transaction_type = 'EXPENSE'
   AND t.transaction_date BETWEEN b.month_start AND b.month_end
GROUP BY
    b.user_id,
    b.budget_id,
    c.category_name,
    b.month_start,
    b.month_end,
    b.monthly_limit;
