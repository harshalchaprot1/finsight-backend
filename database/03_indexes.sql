-- ============================================================
-- FinSight Indexes
-- PostgreSQL 16
-- ============================================================

-- Users
CREATE INDEX idx_users_email
ON users(email);

-- Accounts belonging to a user
CREATE INDEX idx_accounts_user_id
ON accounts(user_id);

-- Categories belonging to a user
CREATE INDEX idx_categories_user_id
ON categories(user_id);

-- Merchants belonging to a user
CREATE INDEX idx_merchants_user_id
ON merchants(user_id);

-- Transactions by user and date
CREATE INDEX idx_transactions_user_date
ON transactions(user_id, transaction_date);

-- Transactions by account
CREATE INDEX idx_transactions_account_id
ON transactions(account_id);

-- Transactions by category
CREATE INDEX idx_transactions_category_id
ON transactions(category_id);

-- Transactions by merchant
CREATE INDEX idx_transactions_merchant_id
ON transactions(merchant_id);

-- Transactions by type
CREATE INDEX idx_transactions_type
ON transactions(transaction_type);

-- Budgets by user and period
CREATE INDEX idx_budgets_user_period
ON budgets(user_id, month_start, month_end);

-- Obligations by user and due date
CREATE INDEX idx_obligations_user_due_date
ON obligations(user_id, due_date);

-- Pending obligations
CREATE INDEX idx_obligations_pending
ON obligations(user_id, due_date)
WHERE status = 'PENDING';

-- Password reset token lookup
CREATE INDEX idx_password_reset_user
ON password_reset_tokens(user_id);

CREATE INDEX idx_password_reset_expiry
ON password_reset_tokens(expires_at);
