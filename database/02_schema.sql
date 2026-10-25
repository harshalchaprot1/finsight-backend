-- ============================================================
-- FinSight Database Schema
-- PostgreSQL 16
-- ============================================================

-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE users (
    user_id         BIGINT GENERATED ALWAYS AS IDENTITY,
    username        VARCHAR(50)  NOT NULL,
    email           VARCHAR(120) NOT NULL,
    password_hash   TEXT         NOT NULL,
    date_of_birth   DATE,
    profile_type    VARCHAR(20)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_users PRIMARY KEY (user_id),

    CONSTRAINT uq_users_username
        UNIQUE (username),

    CONSTRAINT uq_users_email
        UNIQUE (email),

    CONSTRAINT chk_users_profile_type
        CHECK (profile_type IN (
            'STUDENT',
            'EMPLOYEE',
            'FREELANCER',
            'BUSINESS_OWNER'
        ))
);


-- ============================================================
-- 2. ACCOUNTS
-- ============================================================

CREATE TABLE accounts (
    account_id       BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id          BIGINT       NOT NULL,
    account_name     VARCHAR(80)  NOT NULL,
    account_type     VARCHAR(20)  NOT NULL,
    opening_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_archived      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_accounts PRIMARY KEY (account_id),

    CONSTRAINT uq_accounts_user_account
        UNIQUE (user_id, account_id),

    CONSTRAINT chk_accounts_type
        CHECK (account_type IN (
            'BANK',
            'SAVINGS',
            'CASH',
            'WALLET',
            'CREDIT_CARD'
        )),

    CONSTRAINT chk_accounts_opening_balance
        CHECK (opening_balance >= 0),

    CONSTRAINT fk_accounts_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 3. CATEGORIES
-- ============================================================

CREATE TABLE categories (
    category_id    BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id        BIGINT      NOT NULL,
    category_name  VARCHAR(60) NOT NULL,
    category_type  VARCHAR(10) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_categories PRIMARY KEY (category_id),

    CONSTRAINT uq_categories_user_category
        UNIQUE (user_id, category_id),

    CONSTRAINT uq_categories_name
        UNIQUE (user_id, category_type, category_name),

    CONSTRAINT chk_categories_type
        CHECK (category_type IN ('INCOME', 'EXPENSE')),

    CONSTRAINT fk_categories_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 4. MERCHANTS
-- ============================================================

CREATE TABLE merchants (
    merchant_id    BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id        BIGINT       NOT NULL,
    merchant_name  VARCHAR(120) NOT NULL,
    merchant_type  VARCHAR(50),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_merchants PRIMARY KEY (merchant_id),

    CONSTRAINT uq_merchants_user_merchant
        UNIQUE (user_id, merchant_id),

    CONSTRAINT uq_merchants_name
        UNIQUE (user_id, merchant_name),

    CONSTRAINT fk_merchants_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 5. PAYMENT METHODS
-- ============================================================

CREATE TABLE payment_methods (
    payment_method_id  SMALLINT GENERATED ALWAYS AS IDENTITY,
    method_name        VARCHAR(30) NOT NULL,
    description        TEXT,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_payment_methods PRIMARY KEY (payment_method_id),

    CONSTRAINT uq_payment_methods_name
        UNIQUE (method_name)
);


-- ============================================================
-- 6. BUDGETS
-- ============================================================

CREATE TABLE budgets (
    budget_id      BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id        BIGINT        NOT NULL,
    category_id    BIGINT        NOT NULL,
    monthly_limit  NUMERIC(14,2) NOT NULL,
    month_start    DATE          NOT NULL,
    month_end      DATE          NOT NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_budgets PRIMARY KEY (budget_id),

    CONSTRAINT uq_budgets_user_budget
        UNIQUE (user_id, budget_id),

    CONSTRAINT uq_budgets_period
        UNIQUE (user_id, category_id, month_start),

    CONSTRAINT chk_budgets_limit
        CHECK (monthly_limit > 0),

    CONSTRAINT chk_budgets_dates
        CHECK (month_start <= month_end),

    CONSTRAINT fk_budgets_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_budgets_category
        FOREIGN KEY (user_id, category_id)
        REFERENCES categories(user_id, category_id)
        ON DELETE RESTRICT
);


-- ============================================================
-- 7. OBLIGATIONS
-- ============================================================

CREATE TABLE obligations (
    obligation_id  BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id        BIGINT       NOT NULL,
    title          VARCHAR(120) NOT NULL,
    amount         NUMERIC(14,2) NOT NULL,
    due_date       DATE         NOT NULL,
    recurrence     VARCHAR(15)  NOT NULL DEFAULT 'NONE',
    priority       VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM',
    status         VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    category_id    BIGINT,
    merchant_id    BIGINT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_obligations PRIMARY KEY (obligation_id),

    CONSTRAINT uq_obligations_user_obligation
        UNIQUE (user_id, obligation_id),

    CONSTRAINT chk_obligations_amount
        CHECK (amount > 0),

    CONSTRAINT chk_obligations_recurrence
        CHECK (recurrence IN (
            'NONE',
            'WEEKLY',
            'MONTHLY',
            'YEARLY'
        )),

    CONSTRAINT chk_obligations_priority
        CHECK (priority IN (
            'LOW',
            'MEDIUM',
            'HIGH'
        )),

    CONSTRAINT chk_obligations_status
        CHECK (status IN (
            'PENDING',
            'PAID',
            'CANCELLED'
        )),

    CONSTRAINT fk_obligations_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_obligations_category
        FOREIGN KEY (user_id, category_id)
        REFERENCES categories(user_id, category_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_obligations_merchant
        FOREIGN KEY (user_id, merchant_id)
        REFERENCES merchants(user_id, merchant_id)
        ON DELETE RESTRICT
);


-- ============================================================
-- 8. TRANSACTIONS
-- ============================================================

CREATE TABLE transactions (
    transaction_id      BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id             BIGINT        NOT NULL,
    account_id          BIGINT        NOT NULL,
    to_account_id       BIGINT,
    category_id         BIGINT,
    merchant_id         BIGINT,
    payment_method_id   SMALLINT      NOT NULL,
    obligation_id       BIGINT,
    transaction_type    VARCHAR(10)   NOT NULL,
    amount              NUMERIC(14,2) NOT NULL,
    transaction_date    DATE          NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_transactions PRIMARY KEY (transaction_id),

    CONSTRAINT chk_transactions_amount
        CHECK (amount > 0),

    CONSTRAINT chk_transactions_type
        CHECK (transaction_type IN (
            'INCOME',
            'EXPENSE',
            'TRANSFER',
            'REFUND'
        )),

    CONSTRAINT chk_transactions_transfer
        CHECK (
            (
                transaction_type = 'TRANSFER'
                AND to_account_id IS NOT NULL
                AND to_account_id <> account_id
                AND category_id IS NULL
            )
            OR
            (
                transaction_type <> 'TRANSFER'
                AND to_account_id IS NULL
            )
        ),

    CONSTRAINT fk_transactions_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transactions_account
        FOREIGN KEY (user_id, account_id)
        REFERENCES accounts(user_id, account_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_transactions_to_account
        FOREIGN KEY (user_id, to_account_id)
        REFERENCES accounts(user_id, account_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_transactions_category
        FOREIGN KEY (user_id, category_id)
        REFERENCES categories(user_id, category_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_transactions_merchant
        FOREIGN KEY (user_id, merchant_id)
        REFERENCES merchants(user_id, merchant_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_transactions_payment_method
        FOREIGN KEY (payment_method_id)
        REFERENCES payment_methods(payment_method_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_transactions_obligation
        FOREIGN KEY (user_id, obligation_id)
        REFERENCES obligations(user_id, obligation_id)
        ON DELETE RESTRICT
);


-- ============================================================
-- 9. PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE password_reset_tokens (
    reset_token_id  BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id        BIGINT       NOT NULL,
    token_hash     TEXT         NOT NULL,
    expires_at     TIMESTAMPTZ  NOT NULL,
    used_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_password_reset_tokens
        PRIMARY KEY (reset_token_id),

    CONSTRAINT uq_password_reset_token_hash
        UNIQUE (token_hash),

    CONSTRAINT chk_password_reset_expiry
        CHECK (expires_at > created_at),

    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================

SELECT
    table_name
FROM information_schema.tables

WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
