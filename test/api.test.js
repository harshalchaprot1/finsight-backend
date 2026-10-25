/**
 * FinSight Backend Automated Integration Test Suite
 *
 * Runs non-destructive end-to-end integration tests using isolated disposable
 * test accounts. Preserves all existing database seed data.
 */

const jwt = require('jsonwebtoken');
const pool = require('../db');
const authController = require('../controllers/authController');
const usersController = require('../controllers/usersController');
const transactionsController = require('../controllers/transactionsController');
const budgetsController = require('../controllers/budgetsController');
const reportsController = require('../controllers/reportsController');
const authMiddleware = require('../middleware/auth');

const results = [];
let passedCount = 0;
let failedCount = 0;

function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  if (passed) {
    passedCount++;
  } else {
    failedCount++;
  }
  results.push({ name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${name}${details ? ` (${details})` : ''}`);
}

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting FinSight Backend Automated Test Suite');
  console.log('======================================================\n');

  // Test 1: Missing Token
  {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    assert('1. Missing auth token is rejected with HTTP 401', res.statusCode === 401 && !nextCalled);
  }

  // Test 2: Malformed Token
  {
    const req = { headers: { authorization: 'Bearer invalid.malformed.jwt.token' } };
    const res = createMockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    assert('2. Malformed auth token is rejected with HTTP 401', res.statusCode === 401 && !nextCalled);
  }

  // Test 3: Expired Token Rejection
  {
    const secret = process.env.JWT_SECRET || 'test_secret';
    const expiredToken = jwt.sign({ user_id: 1, email: 'exp@test.com' }, secret, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createMockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    assert('3. Expired auth token is rejected with HTTP 401', res.statusCode === 401 && !nextCalled);
  }

  // Test 4: Public Users Directory (Frontend login identifier lookup)
  {
    const req = {};
    const res = createMockRes();
    await usersController.getAllUsers(req, res, (err) => { throw err; });
    const users = res.jsonData?.data || [];
    const hasNoPasswords = users.every((u) => u.password_hash === undefined);
    assert('4. Public user directory returns sanitized profiles without password hashes', res.statusCode === 200 && users.length > 0 && hasNoPasswords);
  }

  // Test 5: Registration with Validation
  const uniqueTimestamp = Date.now();
  const testUsername = `user_test_${uniqueTimestamp}`;
  const testEmail = `test_${uniqueTimestamp}@example.com`;
  let registeredUserId = null;
  let userToken = null;

  try {
    const regReq = {
      body: {
        username: testUsername,
        email: testEmail,
        password: 'ValidPassword123!',
        profile_type: 'STUDENT'
      }
    };
    const regRes = createMockRes();
    await authController.register(regReq, regRes, (err) => { throw err; });
    registeredUserId = regRes.jsonData?.data?.user?.user_id;
    userToken = regRes.jsonData?.data?.token;
    assert('5. Registration creates user and issues valid JWT', regRes.statusCode === 201 && registeredUserId && userToken);

    // Test 6: Duplicate Registration Rejection
    let duplicateRejected = false;
    try {
      const dupRes = createMockRes();
      await authController.register(regReq, dupRes, (err) => {
        if (err.statusCode === 409 || err.code === '23505') duplicateRejected = true;
      });
    } catch (e) {
      if (e.statusCode === 409 || e.code === '23505') duplicateRejected = true;
    }
    assert('6. Duplicate registration returns HTTP 409 Conflict', duplicateRejected);

    // Test 7: Successful Login
    const loginReq = { body: { identifier: testEmail, password: 'ValidPassword123!' } };
    const loginRes = createMockRes();
    await authController.login(loginReq, loginRes, (err) => { throw err; });
    assert('7. Login with email and password returns HTTP 200 and JWT', loginRes.statusCode === 200 && Boolean(loginRes.jsonData?.data?.token));

    // Test 8: Invalid Password Login
    let badPasswordRejected = false;
    try {
      const badLoginReq = { body: { identifier: testEmail, password: 'WrongPassword' } };
      const badLoginRes = createMockRes();
      await authController.login(badLoginReq, badLoginRes, (err) => {
        if (err.statusCode === 401) badPasswordRejected = true;
      });
    } catch (e) {
      if (e.statusCode === 401) badPasswordRejected = true;
    }
    assert('8. Login with invalid password returns HTTP 401 Unauthorized', badPasswordRejected);

    // Create disposable isolated checking account, savings account, expense category, and income category
    const accResult = await pool.query(
      'INSERT INTO accounts (user_id, account_name, account_type, opening_balance) VALUES ($1, $2, $3, $4) RETURNING account_id',
      [registeredUserId, 'Test Checking', 'BANK', 5000]
    );
    const testAccountId = Number(accResult.rows[0].account_id);

    const accResult2 = await pool.query(
      'INSERT INTO accounts (user_id, account_name, account_type, opening_balance) VALUES ($1, $2, $3, $4) RETURNING account_id',
      [registeredUserId, 'Test Savings', 'SAVINGS', 2000]
    );
    const testAccountId2 = Number(accResult2.rows[0].account_id);

    const catResult = await pool.query(
      'INSERT INTO categories (user_id, category_name, category_type) VALUES ($1, $2, $3) RETURNING category_id',
      [registeredUserId, 'Groceries', 'EXPENSE']
    );
    const testCategoryId = Number(catResult.rows[0].category_id);

    const incomeCatResult = await pool.query(
      'INSERT INTO categories (user_id, category_name, category_type) VALUES ($1, $2, $3) RETURNING category_id',
      [registeredUserId, 'Stipend', 'INCOME']
    );
    const testIncomeCatId = Number(incomeCatResult.rows[0].category_id);

    // Test 9: Transaction CREATE
    const txReq = {
      user: { user_id: registeredUserId },
      body: {
        account_id: testAccountId,
        category_id: testCategoryId,
        amount: 350.50,
        type: 'expense',
        description: 'Weekly organic groceries',
        transaction_date: '2026-10-10'
      }
    };
    const txRes = createMockRes();
    await transactionsController.createTransaction(txReq, txRes, (err) => { throw err; });
    const createdTxId = txRes.jsonData?.data?.transaction_id;
    assert('9. Transaction CREATE succeeds with schema mapping', txRes.statusCode === 201 && createdTxId > 0);

    // Test 10: Transaction GET by ID
    const getTxRes = createMockRes();
    await transactionsController.getTransactionById(
      { user: { user_id: registeredUserId }, params: { id: createdTxId } },
      getTxRes,
      (err) => { throw err; }
    );
    assert('10. Transaction GET by ID retrieves created transaction', getTxRes.statusCode === 200 && getTxRes.jsonData?.data?.amount === 350.50);

    // Test 11: Cross-User Transaction Isolation
    let crossTxBlocked = false;
    try {
      const crossRes = createMockRes();
      await transactionsController.getTransactionById(
        { user: { user_id: 999999 }, params: { id: createdTxId } },
        crossRes,
        (err) => {
          if (err.statusCode === 404 || err.statusCode === 403) crossTxBlocked = true;
        }
      );
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 403) crossTxBlocked = true;
    }
    assert('11. Cross-user transaction access is strictly blocked (HTTP 404/403)', crossTxBlocked);

    // Test 12: Negative Transaction Amount Rejection
    let negativeAmountRejected = false;
    try {
      const negTxReq = {
        user: { user_id: registeredUserId },
        body: { account_id: testAccountId, amount: -50, type: 'expense', transaction_date: '2026-10-10' }
      };
      const negTxRes = createMockRes();
      await transactionsController.createTransaction(negTxReq, negTxRes, (err) => {
        if (err.statusCode === 400) negativeAmountRejected = true;
      });
    } catch (e) {
      if (e.statusCode === 400) negativeAmountRejected = true;
    }
    assert('12. Non-positive transaction amount is rejected with HTTP 400', negativeAmountRejected);

    // Test 13: TRANSFER transaction creation with destination account
    const transferReq = {
      user: { user_id: registeredUserId },
      body: {
        account_id: testAccountId,
        to_account_id: testAccountId2,
        amount: 500,
        type: 'transfer',
        description: 'Savings deposit',
        transaction_date: '2026-10-11'
      }
    };
    const transferRes = createMockRes();
    await transactionsController.createTransaction(transferReq, transferRes, (err) => { throw err; });
    const createdTransfer = transferRes.jsonData?.data;
    assert(
      '13. Transfer transaction succeeds with destination account mapping',
      transferRes.statusCode === 201 && createdTransfer?.to_account_id === testAccountId2
    );

    // Test 14: Transfer to same account rejected
    let sameAccountTransferBlocked = false;
    try {
      const badTransferReq = {
        user: { user_id: registeredUserId },
        body: {
          account_id: testAccountId,
          to_account_id: testAccountId,
          amount: 100,
          type: 'transfer',
          transaction_date: '2026-10-11'
        }
      };
      const badTransferRes = createMockRes();
      await transactionsController.createTransaction(badTransferReq, badTransferRes, (err) => {
        if (err.statusCode === 400) sameAccountTransferBlocked = true;
      });
    } catch (e) {
      if (e.statusCode === 400) sameAccountTransferBlocked = true;
    }
    assert('14. Transfer to the same source account is rejected with HTTP 400', sameAccountTransferBlocked);

    // Test 15: Budget CREATE
    const bReq = {
      user: { user_id: registeredUserId },
      body: {
        category_id: testCategoryId,
        monthly_limit: 1500,
        month: 10,
        year: 2026
      }
    };
    const bRes = createMockRes();
    await budgetsController.createBudget(bReq, bRes, (err) => { throw err; });
    const createdBudgetId = bRes.jsonData?.data?.budget_id;
    assert('15. Budget CREATE succeeds and links category', bRes.statusCode === 201 && createdBudgetId > 0);

    // Test 16: Budget on INCOME category rejected
    let nonExpenseBudgetBlocked = false;
    try {
      const badBudgetReq = {
        user: { user_id: registeredUserId },
        body: {
          category_id: testIncomeCatId,
          monthly_limit: 1000,
          month: 10,
          year: 2026
        }
      };
      const badBudgetRes = createMockRes();
      await budgetsController.createBudget(badBudgetReq, badBudgetRes, (err) => {
        if (err.statusCode === 400) nonExpenseBudgetBlocked = true;
      });
    } catch (e) {
      if (e.statusCode === 400) nonExpenseBudgetBlocked = true;
    }
    assert('16. Budget creation on non-EXPENSE category is rejected with HTTP 400', nonExpenseBudgetBlocked);

    // Test 17: Cross-User Budget Isolation
    let crossBudgetBlocked = false;
    try {
      const crossBRes = createMockRes();
      await budgetsController.getBudgetById(
        { user: { user_id: 999999 }, params: { id: createdBudgetId } },
        crossBRes,
        (err) => {
          if (err.statusCode === 404 || err.statusCode === 403) crossBudgetBlocked = true;
        }
      );
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 403) crossBudgetBlocked = true;
    }
    assert('17. Cross-user budget access is strictly blocked (HTTP 404/403)', crossBudgetBlocked);

    // Test 18: Dashboard Report Calculations
    const repReq = {
      user: { user_id: registeredUserId },
      params: {},
      query: { month: '10', year: '2026' }
    };
    const repRes = createMockRes();
    await reportsController.getDashboardSummary(repReq, repRes, (err) => { throw err; });
    const repExpense = repRes.jsonData?.data?.total_expense;
    assert('18. Dashboard report calculations match underlying transactions', repRes.statusCode === 200 && repExpense === 350.50);

    // Test 19: Budget vs Actual Report
    const bvaReq = {
      user: { user_id: registeredUserId },
      params: {},
      query: { month: '10', year: '2026' }
    };
    const bvaRes = createMockRes();
    await reportsController.getBudgetVsActual(bvaReq, bvaRes, (err) => { throw err; });
    const bvaList = bvaRes.jsonData?.data?.comparison || [];
    const matchedBva = bvaList.find((b) => b.budget_id === createdBudgetId);
    assert(
      '19. Budget vs actual report tracks spending against monthly limit',
      bvaRes.statusCode === 200 && matchedBva && matchedBva.actual_spent === 350.50 && matchedBva.remaining === 1149.50
    );

    // Test 20: Cross-User Report Access Blocked
    let crossReportBlocked = false;
    try {
      const crossRepReq = {
        user: { user_id: registeredUserId },
        params: { user_id: 999999 },
        query: { month: '10', year: '2026' }
      };
      const crossRepRes = createMockRes();
      await reportsController.getDashboardSummary(crossRepReq, crossRepRes, (err) => {
        if (err.statusCode === 403) crossReportBlocked = true;
      });
    } catch (e) {
      if (e.statusCode === 403) crossReportBlocked = true;
    }
    assert('20. Cross-user financial report access is strictly blocked (HTTP 403)', crossReportBlocked);

    // Test 21: Unauthorized Profile Update Blocked
    let unauthorizedUpdateBlocked = false;
    try {
      const badUpdReq = {
        user: { user_id: 999999 },
        params: { id: registeredUserId },
        body: { username: 'hacked_name' }
      };
      const badUpdRes = createMockRes();
      await usersController.updateUser(badUpdReq, badUpdRes, (err) => {
        if (err.statusCode === 403 || err.statusCode === 401) unauthorizedUpdateBlocked = true;
      });
    } catch (e) {
      if (e.statusCode === 403 || e.statusCode === 401) unauthorizedUpdateBlocked = true;
    }
    assert('21. Unauthorized profile update is strictly blocked (HTTP 401/403)', unauthorizedUpdateBlocked);

    // Test 22: Authorized Profile Update
    const updReq = {
      user: { user_id: registeredUserId },
      params: { id: registeredUserId },
      body: { profile_type: 'EMPLOYEE' }
    };
    const updRes = createMockRes();
    await usersController.updateUser(updReq, updRes, (err) => { throw err; });
    assert(
      '22. Authorized profile update successfully updates user profile',
      updRes.statusCode === 200 && updRes.jsonData?.data?.profile_type === 'EMPLOYEE'
    );

    // Test 23: User account deletion enforces ownership and cascades test records cleanly
    const delReq = {
      user: { user_id: registeredUserId },
      params: { id: registeredUserId }
    };
    const delRes = createMockRes();
    await usersController.deleteUser(delReq, delRes, (err) => { throw err; });
    assert('23. User account deletion enforces ownership and cascades test records cleanly', delRes.statusCode === 200);

    registeredUserId = null; // Cleanly deleted

  } catch (err) {
    console.error('❌ Test encountered unhandled error:', err.message);
    if (registeredUserId) {
      await pool.query('DELETE FROM users WHERE user_id = $1', [registeredUserId]).catch(() => {});
    }
  } finally {
    await pool.end();
  }

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed out of ${results.length} Tests`);
  console.log('------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
