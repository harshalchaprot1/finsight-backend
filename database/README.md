# FinSight Database

## Overview
FinSight is a personal finance management project built using PostgreSQL. It stores users, accounts, transactions, budgets, merchants, categories, payment methods, obligations, and password reset tokens.

## Technology
- Database: PostgreSQL 16
- Database IDE: DataGrip
- Schema: `public`

## Database Tables
1. `users` — user profiles and authentication details.
2. `accounts` — bank, savings, cash, wallet, and credit-card accounts.
3. `categories` — income and expense categories.
4. `merchants` — transaction merchants.
5. `payment_methods` — supported payment methods.
6. `budgets` — category-based budgets.
7. `obligations` — upcoming bills and recurring payments.
8. `transactions` — income, expenses, transfers, and refunds.
9. `password_reset_tokens` — password-reset token records.

## SQL Scripts
- `01_database_setup.sql` — database connection verification.
- `02_schema.sql` — table definitions and constraints.
- `03_indexes.sql` — indexes for common queries.
- `04_views.sql` — account balances, monthly summaries, and budget status.
- `05_functions.sql` — reusable financial calculation functions.
- `06_seed_data.sql` — sample data for testing.
- `07_advanced_queries.sql` — joins, CTEs, subqueries, aggregates, and window functions.
- `08_test_cases.sql` — database verification queries.
- `09_cleanup.sql` — optional development reset script; destructive statements are commented out.

## Relationships
- A user can own multiple accounts, categories, merchants, budgets, transactions, and obligations.
- Transactions reference accounts, payment methods, and optionally categories, merchants, and obligations.
- Budgets are linked to expense categories.
- Foreign keys and check constraints help maintain data integrity.

## Important Notes
- Seed data is for development and testing only.
- The sample password hashes must be replaced with real securely generated password hashes before testing authentication.
- Cleanup statements can permanently delete data if uncommented and executed.
- The application backend must verify the authenticated user and restrict access to that user's financial records.
