
-- ============================================================
-- FinSight: Database Test Cases
-- PostgreSQL 16
-- ============================================================


-- TEST 1: Verify all 9 tables exist
SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';


-- TEST 2: Check seeded users
SELECT
    username,
    email,
    profile_type
FROM users
ORDER BY username;


-- TEST 3: Check accounts and opening balances
SELECT
    u.username,
    COUNT(a.account_id) AS total_accounts,
    COALESCE(SUM(a.opening_balance), 0) AS total_opening_balance
FROM users u
LEFT JOIN accounts a ON a.user_id = u.user_id
GROUP BY u.user_id, u.username
ORDER BY u.username;


-- TEST 4: Verify transaction amounts are positive
SELECT COUNT(*) AS invalid_transactions
FROM transactions
WHERE amount <= 0;


-- TEST 5: Check transactions have valid accounts
SELECT COUNT(*) AS invalid_account_references
FROM transactions t
LEFT JOIN accounts a
    ON a.account_id = t.account_id
   AND a.user_id = t.user_id
WHERE a.account_id IS NULL;


-- TEST 6: Verify payment methods are populated
SELECT
    method_name,
    is_active
FROM payment_methods
ORDER BY method_name;


-- TEST 7: Verify monthly budget calculations
SELECT
    category_name,
    monthly_limit,
    actual_spending,
    remaining_budget,
    utilization_percentage
FROM v_budget_status
ORDER BY category_name;


-- TEST 8: Verify monthly financial summary
SELECT *
FROM v_monthly_financial_summary
ORDER BY month DESC;


-- TEST 9: Check pending obligations
SELECT
    title,
    amount,
    due_date,
    priority,
    status
FROM obligations
WHERE status = 'PENDING'
ORDER BY due_date;


-- TEST 10: Verify no duplicate category names per user and type
SELECT
    user_id,
    category_type,
    category_name,
    COUNT(*) AS duplicate_count
FROM categories
GROUP BY user_id, category_type, category_name
HAVING COUNT(*) > 1;


-- TEST 11: Verify no duplicate merchant names per user
SELECT
    user_id,
    merchant_name,
    COUNT(*) AS duplicate_count
FROM merchants
GROUP BY user_id, merchant_name
HAVING COUNT(*) > 1;



-- TEST 12: Verify account balances view
SELECT
    u.username,
    v.account_name,
    v.current_balance
FROM v_account_balances v
JOIN users u
    ON u.user_id = v.user_id
ORDER BY u.username, v.account_name;
