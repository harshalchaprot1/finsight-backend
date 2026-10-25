
-- ============================================================
-- FinSight Sample Data
-- PostgreSQL 16
-- ============================================================

BEGIN;

-- 1. Payment methods
INSERT INTO payment_methods (method_name, description)
VALUES
    ('UPI', 'Unified Payments Interface'),
    ('CASH', 'Cash payment'),
    ('DEBIT_CARD', 'Debit card payment'),
    ('CREDIT_CARD', 'Credit card payment'),
    ('NET_BANKING', 'Internet banking'),
    ('WALLET', 'Digital wallet payment')
ON CONFLICT (method_name) DO NOTHING;


-- 2. Demo users (fictional data)
INSERT INTO users
    (username, email, password_hash, date_of_birth, profile_type)
VALUES
    ('demo_harshal', 'demo.harshal@example.com',
     '$2b$12$REPLACE_WITH_A_REAL_BCRYPT_HASH', '2005-01-15', 'STUDENT'),
    ('demo_riya', 'demo.riya@example.com',
     '$2b$12$REPLACE_WITH_A_REAL_BCRYPT_HASH', '2004-08-22', 'STUDENT')
ON CONFLICT (username) DO NOTHING;


-- 3. Accounts
INSERT INTO accounts
    (user_id, account_name, account_type, opening_balance)
SELECT u.user_id, v.account_name, v.account_type, v.opening_balance
FROM users u
CROSS JOIN (
    VALUES
        ('Main Bank', 'BANK', 25000.00::NUMERIC(14,2)),
        ('Savings', 'SAVINGS', 50000.00::NUMERIC(14,2)),
        ('Cash Wallet', 'CASH', 2000.00::NUMERIC(14,2))
) AS v(account_name, account_type, opening_balance)
WHERE u.username = 'demo_harshal'
  AND NOT EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.user_id = u.user_id
        AND a.account_name = v.account_name
  );


-- 4. Categories
INSERT INTO categories (user_id, category_name, category_type)
SELECT u.user_id, v.category_name, v.category_type
FROM users u
CROSS JOIN (
    VALUES
        ('Salary', 'INCOME'),
        ('Food', 'EXPENSE'),
        ('Transport', 'EXPENSE'),
        ('Shopping', 'EXPENSE'),
        ('Education', 'EXPENSE'),
        ('Freelance', 'INCOME')
) AS v(category_name, category_type)
WHERE u.username = 'demo_harshal'
ON CONFLICT (user_id, category_type, category_name) DO NOTHING;


-- 5. Merchants
INSERT INTO merchants (user_id, merchant_name, merchant_type)
SELECT u.user_id, v.merchant_name, v.merchant_type
FROM users u
CROSS JOIN (
    VALUES
        ('SRM Canteen', 'FOOD'),
        ('Swiggy', 'FOOD_DELIVERY'),
        ('Uber', 'TRANSPORT'),
        ('Amazon', 'SHOPPING'),
        ('College Fees', 'EDUCATION')
) AS v(merchant_name, merchant_type)
WHERE u.username = 'demo_harshal'
ON CONFLICT (user_id, merchant_name) DO NOTHING;


-- 6. Monthly budgets for October 2026
INSERT INTO budgets
    (user_id, category_id, monthly_limit, month_start, month_end)
SELECT
    u.user_id,
    c.category_id,
    v.monthly_limit,
    DATE '2026-10-01',
    DATE '2026-10-31'
FROM users u
JOIN (
    VALUES
        ('Food', 6000.00::NUMERIC(14,2)),
        ('Transport', 2500.00::NUMERIC(14,2)),
        ('Shopping', 4000.00::NUMERIC(14,2)),
        ('Education', 10000.00::NUMERIC(14,2))
) AS v(category_name, monthly_limit) ON TRUE
JOIN categories c
    ON c.user_id = u.user_id
   AND c.category_name = v.category_name
   AND c.category_type = 'EXPENSE'
WHERE u.username = 'demo_harshal'
ON CONFLICT (user_id, category_id, month_start) DO NOTHING;


-- 7. Transactions
INSERT INTO transactions
    (user_id, account_id, category_id, merchant_id,
     payment_method_id, transaction_type, amount,
     transaction_date, description)
SELECT
    u.user_id,
    a.account_id,
    c.category_id,
    m.merchant_id,
    pm.payment_method_id,
    v.transaction_type,
    v.amount,
    v.transaction_date,
    v.description
FROM users u
JOIN (
    VALUES
        ('Main Bank', 'Salary', 'INCOME', 'Salary', 'NET_BANKING',
         45000.00::NUMERIC(14,2), DATE '2026-10-01',
         'Monthly income'),
        ('Cash Wallet', 'Food', 'EXPENSE', 'SRM Canteen', 'UPI',
         180.00::NUMERIC(14,2), DATE '2026-10-02',
         'Lunch at campus'),
        ('Main Bank', 'Transport', 'EXPENSE', 'Uber', 'UPI',
         320.00::NUMERIC(14,2), DATE '2026-10-03',
         'Ride to campus'),
        ('Main Bank', 'Shopping', 'EXPENSE', 'Amazon', 'DEBIT_CARD',
         1499.00::NUMERIC(14,2), DATE '2026-10-04',
         'Online purchase'),
        ('Cash Wallet', 'Food', 'EXPENSE', 'Swiggy', 'UPI',
         450.00::NUMERIC(14,2), DATE '2026-10-05',
         'Food delivery'),
        ('Main Bank', 'Freelance', 'INCOME', NULL, 'NET_BANKING',
         5000.00::NUMERIC(14,2), DATE '2026-10-06',
         'Freelance payment'),
        ('Main Bank', 'Education', 'EXPENSE', 'College Fees', 'NET_BANKING',
         8000.00::NUMERIC(14,2), DATE '2026-10-07',
         'Education payment'),
        ('Cash Wallet', 'Food', 'EXPENSE', 'SRM Canteen', 'CASH',
         120.00::NUMERIC(14,2), DATE '2026-10-08',
         'Snacks')
) AS v(account_name, category_name, transaction_type, merchant_name,
       payment_method_name, amount, transaction_date, description)
    ON TRUE
JOIN accounts a
    ON a.user_id = u.user_id
   AND a.account_name = v.account_name
JOIN categories c
    ON c.user_id = u.user_id
   AND c.category_name = v.category_name
   AND c.category_type =
       CASE
           WHEN v.transaction_type = 'INCOME' THEN 'INCOME'
           ELSE 'EXPENSE'
       END
JOIN payment_methods pm
    ON pm.method_name = v.payment_method_name
LEFT JOIN merchants m
    ON m.user_id = u.user_id
   AND m.merchant_name = v.merchant_name
WHERE u.username = 'demo_harshal'
  AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      WHERE t.user_id = u.user_id
        AND t.description = v.description
        AND t.transaction_date = v.transaction_date
  );


-- 8. Upcoming obligations
INSERT INTO obligations
    (user_id, title, amount, due_date, recurrence,
     priority, status, category_id, merchant_id)
SELECT
    u.user_id,
    v.title,
    v.amount,
    v.due_date,
    v.recurrence,
    v.priority,
    'PENDING',
    c.category_id,
    m.merchant_id
FROM users u
CROSS JOIN (
    VALUES
        ('Monthly phone bill', 499.00::NUMERIC(14,2),
         DATE '2026-10-15', 'MONTHLY', 'MEDIUM', 'Transport', 'Uber'),
        ('Internet bill', 799.00::NUMERIC(14,2),
         DATE '2026-10-20', 'MONTHLY', 'HIGH', 'Education', 'College Fees')
) AS v(title, amount, due_date, recurrence, priority,
       category_name, merchant_name)
LEFT JOIN categories c
    ON c.user_id = u.user_id
   AND c.category_name = v.category_name
   AND c.category_type = 'EXPENSE'
LEFT JOIN merchants m
    ON m.user_id = u.user_id
   AND m.merchant_name = v.merchant_name
WHERE u.username = 'demo_harshal'
  AND NOT EXISTS (
      SELECT 1
      FROM obligations o
      WHERE o.user_id = u.user_id
        AND o.title = v.title
        AND o.due_date = v.due_date
  );

COMMIT;


-- 9. Verify inserted data
SELECT 'users' AS entity, COUNT(*) AS row_count
FROM users
WHERE username IN ('demo_harshal', 'demo_riya')
UNION ALL
SELECT 'accounts', COUNT(*)
FROM accounts a
JOIN users u ON u.user_id = a.user_id
WHERE u.username = 'demo_harshal'
UNION ALL
SELECT 'transactions', COUNT(*)
FROM transactions t
JOIN users u ON u.user_id = t.user_id
WHERE u.username = 'demo_harshal'
UNION ALL
SELECT 'budgets', COUNT(*)
FROM budgets b
JOIN users u ON u.user_id = b.user_id
WHERE u.username = 'demo_harshal'
UNION ALL
SELECT 'obligations', COUNT(*)
FROM obligations o
JOIN users u ON u.user_id = o.user_id
WHERE u.username = 'demo_harshal';
