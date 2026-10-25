
-- ============================================================
-- FinSight Advanced SQL Queries
-- PostgreSQL 16
-- ============================================================


-- 1. INNER JOIN: Transactions with accounts, categories, and payment methods
SELECT
    t.transaction_id,
    u.username,
    a.account_name,
    c.category_name,
    pm.method_name AS payment_method,
    t.transaction_type,
    t.amount,
    t.transaction_date
FROM transactions t
JOIN users u
    ON u.user_id = t.user_id
JOIN accounts a
    ON a.account_id = t.account_id
   AND a.user_id = t.user_id
LEFT JOIN categories c
    ON c.category_id = t.category_id
   AND c.user_id = t.user_id
JOIN payment_methods pm
    ON pm.payment_method_id = t.payment_method_id
ORDER BY t.transaction_date DESC;


-- 2. LEFT JOIN: Include categories with zero spending
SELECT
    c.category_name,
    COALESCE(SUM(t.amount), 0) AS total_spending
FROM categories c
LEFT JOIN transactions t
    ON t.category_id = c.category_id
   AND t.user_id = c.user_id
   AND t.transaction_type = 'EXPENSE'
GROUP BY c.category_id, c.category_name
ORDER BY total_spending DESC;


-- 3. GROUP BY + HAVING: Categories with spending above 1,000
SELECT
    u.username,
    c.category_name,
    SUM(t.amount) AS total_spending
FROM transactions t
JOIN users u ON u.user_id = t.user_id
JOIN categories c
    ON c.category_id = t.category_id
   AND c.user_id = t.user_id
WHERE t.transaction_type = 'EXPENSE'
GROUP BY u.username, c.category_name
HAVING SUM(t.amount) > 1000
ORDER BY total_spending DESC;


-- 4. CTE: Monthly income and expenses
WITH monthly_totals AS (
    SELECT
        user_id,
        DATE_TRUNC('month', transaction_date)::DATE AS month,
        SUM(amount) FILTER (
            WHERE transaction_type = 'INCOME'
        ) AS income,
        SUM(amount) FILTER (
            WHERE transaction_type = 'EXPENSE'
        ) AS expenses
    FROM transactions
    GROUP BY user_id, DATE_TRUNC('month', transaction_date)::DATE
)
SELECT
    u.username,
    mt.month,
    COALESCE(mt.income, 0) AS income,
    COALESCE(mt.expenses, 0) AS expenses,
    COALESCE(mt.income, 0) - COALESCE(mt.expenses, 0) AS net_savings
FROM monthly_totals mt
JOIN users u ON u.user_id = mt.user_id
ORDER BY mt.month DESC, u.username;


-- 5. SUBQUERY: Transactions above the user's average transaction amount
SELECT
    t.transaction_id,
    u.username,
    t.transaction_type,
    t.amount,
    t.transaction_date
FROM transactions t
JOIN users u ON u.user_id = t.user_id
WHERE t.amount > (
    SELECT AVG(t2.amount)
    FROM transactions t2
    WHERE t2.user_id = t.user_id
)
ORDER BY t.amount DESC;


-- 6. WINDOW FUNCTION: Rank spending categories for each user
WITH category_spending AS (
    SELECT
        t.user_id,
        t.category_id,
        SUM(t.amount) AS total_spending
    FROM transactions t
    WHERE t.transaction_type = 'EXPENSE'
    GROUP BY t.user_id, t.category_id
)
SELECT
    u.username,
    c.category_name,
    cs.total_spending,
    RANK() OVER (
        PARTITION BY cs.user_id
        ORDER BY cs.total_spending DESC
    ) AS spending_rank
FROM category_spending cs
JOIN users u ON u.user_id = cs.user_id
JOIN categories c
    ON c.category_id = cs.category_id
   AND c.user_id = cs.user_id
ORDER BY u.username, spending_rank;


-- 7. LAG: Compare monthly expenses with the previous month
WITH monthly_expenses AS (
    SELECT
        user_id,
        DATE_TRUNC('month', transaction_date)::DATE AS month,
        SUM(amount) AS total_expenses
    FROM transactions
    WHERE transaction_type = 'EXPENSE'
    GROUP BY user_id, DATE_TRUNC('month', transaction_date)::DATE
)
SELECT
    u.username,
    me.month,
    me.total_expenses,
    LAG(me.total_expenses) OVER (
        PARTITION BY me.user_id
        ORDER BY me.month
    ) AS previous_month_expenses,
    me.total_expenses
      - LAG(me.total_expenses) OVER (
            PARTITION BY me.user_id
            ORDER BY me.month
        ) AS expense_change
FROM monthly_expenses me
JOIN users u ON u.user_id = me.user_id
ORDER BY u.username, me.month;


-- 8. CASE: Classify budget utilization
SELECT
    user_id,
    category_name,
    monthly_limit,
    actual_spending,
    utilization_percentage,
    CASE
        WHEN utilization_percentage >= 100 THEN 'OVER BUDGET'
        WHEN utilization_percentage >= 80 THEN 'NEAR LIMIT'
        ELSE 'WITHIN BUDGET'
    END AS budget_status
FROM v_budget_status
ORDER BY utilization_percentage DESC NULLS LAST;


-- 9. FILTER: Summarize income, expenses, and refunds by user
SELECT
    u.username,
    COUNT(t.transaction_id) AS transaction_count,
    COALESCE(SUM(t.amount) FILTER (
        WHERE t.transaction_type = 'INCOME'
    ), 0) AS total_income,
    COALESCE(SUM(t.amount) FILTER (
        WHERE t.transaction_type = 'EXPENSE'
    ), 0) AS total_expenses,
    COALESCE(SUM(t.amount) FILTER (
        WHERE t.transaction_type = 'REFUND'
    ), 0) AS total_refunds
FROM users u
LEFT JOIN transactions t ON t.user_id = u.user_id
GROUP BY u.user_id, u.username
ORDER BY u.username;


-- 10. Upcoming obligations: Include priority and due date
SELECT
    u.username,
    o.title,
    o.amount,
    o.due_date,
    o.priority,
    o.status
FROM obligations o
JOIN users u ON u.user_id = o.user_id
WHERE o.status = 'PENDING'
  AND o.due_date >= CURRENT_DATE
ORDER BY o.due_date, o.priority DESC;



-- 11. Account balances from the balance view
SELECT
    u.username,
    v.account_name,
    v.account_type,
    v.current_balance
FROM v_account_balances v
JOIN users u
    ON u.user_id = v.user_id
ORDER BY u.username, v.account_name;



-- 12. Function usage: Expenses for October 2026
SELECT
    u.username,
    fn_total_expenses(
        u.user_id,
        DATE '2026-10-01',
        DATE '2026-10-31'
    ) AS october_expenses
FROM users u
ORDER BY u.username;


-- 13. Function usage: Upcoming obligations within 30 days
SELECT *
FROM fn_upcoming_obligations(
    (SELECT user_id FROM users WHERE username = 'demo_harshal'),
    CURRENT_DATE + 30
);


-- 14. Available balance after upcoming pending obligations
WITH account_totals AS (
    SELECT
        user_id,
        SUM(current_balance) AS total_balance
    FROM v_account_balances
    GROUP BY user_id
),
upcoming_bills AS (
    SELECT
        user_id,
        SUM(amount) AS upcoming_amount
    FROM obligations
    WHERE status = 'PENDING'
      AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    GROUP BY user_id
)
SELECT
    u.username,
    COALESCE(a.total_balance, 0) AS total_balance,
    COALESCE(b.upcoming_amount, 0) AS upcoming_obligations,
    COALESCE(a.total_balance, 0)
      - COALESCE(b.upcoming_amount, 0) AS available_after_bills
FROM users u
LEFT JOIN account_totals a ON a.user_id = u.user_id
LEFT JOIN upcoming_bills b ON b.user_id = u.user_id
ORDER BY u.username;
