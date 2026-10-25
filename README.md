# FinSight Backend API

FinSight is a secure, production-grade personal finance management REST API built with Node.js, Express, and PostgreSQL. It powers account tracking, expense and income transactions, category budgeting, obligations, and financial analytics.

---

## 1. Technology Stack

- **Runtime:** Node.js (v18+ recommended)
- **Framework:** Express 5
- **Database:** PostgreSQL 16
- **Database Driver:** `pg` (node-postgres connection pool)
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), password hashing (`bcryptjs` with salt rounds 12)
- **Configuration:** `dotenv`

---

## 2. Architecture & Data Model

FinSight enforces strict user isolation and relational data integrity at both the application and database tiers:

- **Users:** Authentication, profiles (`STUDENT`, `EMPLOYEE`, `FREELANCER`, `BUSINESS_OWNER`), secure bcrypt password storage.
- **Accounts:** Financial accounts (`BANK`, `SAVINGS`, `CASH`, `WALLET`, `CREDIT_CARD`) with opening balances.
- **Categories:** Income and expense categories owned by each user.
- **Transactions:** `INCOME`, `EXPENSE`, `TRANSFER`, and `REFUND`. Multi-account transfers enforce source and destination account validation and balances.
- **Budgets:** Monthly category limits with date ranges and utilization tracking.
- **Obligations:** Upcoming recurring bills, dues, and payment priorities.
- **Reports & Views:** Analytical views including `v_account_balances`, `v_monthly_financial_summary`, and `v_budget_status`.

---

## 3. Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **PostgreSQL:** v16.0 or higher running locally or accessible via network

---

## 4. Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/harshalchaprot1/finsight-backend.git
cd finsight-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Configure your `.env` file:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgresql_password
DB_NAME=finsight

# Authentication (JWT)
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_here
JWT_EXPIRES_IN=7d
```

> **Security Note:** The `.env` file contains sensitive credentials and is strictly excluded from version control via `.gitignore`. Never commit `.env` or production credentials.

---

## 5. Database Setup & Migrations

Execute the SQL scripts in order using `psql` or a PostgreSQL GUI (e.g. DataGrip, pgAdmin):

```bash
# 1. Verify / prepare database
psql -U postgres -d finsight -f database/01_database_setup.sql

# 2. Execute table schema and constraints
psql -U postgres -d finsight -f database/02_schema.sql

# 3. Create performance indexes
psql -U postgres -d finsight -f database/03_indexes.sql

# 4. Create analytical views
psql -U postgres -d finsight -f database/04_views.sql

# 5. Create stored functions
psql -U postgres -d finsight -f database/05_functions.sql

# 6. (Optional) Load development seed data
psql -U postgres -d finsight -f database/06_seed_data.sql

# 7. Apply identity sequence migrations (ensures sequence sync)
psql -U postgres -d finsight -f migrations/20261009_make_users_user_id_auto_generated.sql
```

---

## 6. Running the Application

### Development Server
```bash
npm start
# or
npm run dev
```

The API will be available at `http://localhost:3000`.

### Health Check
```bash
curl http://localhost:3000/health
```

---

## 7. Automated Testing

FinSight includes an automated integration test suite that verifies authentication, authorization, cross-user isolation, transfers, budgets, and financial reporting using isolated, disposable test records:

```bash
npm test
```

All test records are cleanly purged upon completion, preserving existing development seed data.

---

## 8. API Reference

All protected endpoints require the HTTP Authorization header:
```http
Authorization: Bearer <your_jwt_token>
```

### Authentication (`/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Register a new user (`username`, `email`, `password`, `profile_type`) |
| `POST` | `/auth/login` | None | Authenticate with username/email and password, returns JWT |

### Users (`/users`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/users` | None | Sanitized public directory (password hashes strictly omitted) |
| `GET` | `/users/:id` | None | Sanitized single user profile |
| `PUT` | `/users/:id` | Bearer | Update user profile (enforces authenticated ownership) |
| `PATCH` | `/users/:id` | Bearer | Partial update user profile (enforces authenticated ownership) |
| `DELETE` | `/users/:id` | Bearer | Delete user account and cascade associated records |

### Transactions (`/transactions`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/transactions` | Bearer | Retrieve all transactions for the authenticated user |
| `GET` | `/transactions/:id` | Bearer | Retrieve a single transaction by ID (ownership checked) |
| `POST` | `/transactions` | Bearer | Create a transaction (`EXPENSE`, `INCOME`, `TRANSFER`, `REFUND`) |
| `PUT` | `/transactions/:id` | Bearer | Update transaction details (ownership checked) |
| `DELETE` | `/transactions/:id` | Bearer | Delete transaction (ownership checked) |

> **Transfer Transactions:** Setting `type: "transfer"` requires a valid destination `to_account_id` belonging to the user and different from the source `account_id`. Transfers set `category_id: null` per database constraints.

### Budgets (`/budgets`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/budgets` | Bearer | Retrieve all budgets with calculated actual spending and utilization |
| `GET` | `/budgets/:id` | Bearer | Retrieve a specific budget by ID (ownership checked) |
| `POST` | `/budgets` | Bearer | Create a category budget (`monthly_limit`, `category_id`, `month_start`, `month_end`) |
| `PUT` | `/budgets/:id` | Bearer | Update budget limit or date periods |
| `DELETE` | `/budgets/:id` | Bearer | Delete budget |

### Reports & Analytics (`/reports`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/reports/summary` | Bearer | Current month dashboard summary (income, expenses, net savings, top categories) |
| `GET` | `/reports/dashboard` | Bearer | Alias for dashboard summary |
| `GET` | `/reports/monthly/:user_id` | Bearer | Monthly spending grouped by category |
| `GET` | `/reports/annual/:user_id` | Bearer | Annual spending grouped by category |
| `GET` | `/reports/summary/monthly/:user_id`| Bearer | Month-by-month cash flow breakdown for charts |
| `GET` | `/reports/budget-vs-actual/:user_id`| Bearer | Budget limits vs. actual spending with budget health status |

---

## 9. Security Principles

1. **Strict User Isolation:** All resource queries (`transactions`, `budgets`, `reports`, `accounts`) enforce `user_id = $1` extracted directly from the verified JWT payload. Users cannot read, mutate, or delete another user's financial data.
2. **Password Security:** Passwords are never stored in plain text. Hashing utilizes bcrypt with salt cost factor 12.
3. **No Credential Exposure:** Database queries for user profiles explicitly select safe columns, completely excluding `password_hash`.
4. **SQL Injection Prevention:** Every query uses parameterized inputs (`$1`, `$2`, ...) exclusively.
5. **CORS & Headers:** Configured with origin validation, credential support, and allowed HTTP methods.
6. **Error Sanitization:** Database constraint violations are converted to standard HTTP statuses (`409 Conflict`, `400 Bad Request`, `404 Not Found`, `403 Forbidden`) without leaking internal SQL server traces in production.
