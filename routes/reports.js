const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  getDashboardSummary,
  getMonthlyReport,
  getAnnualReport,
  getMonthlySummary,
  getBudgetVsActual
} = require('../controllers/reportsController');

// All reports require valid authentication
router.use(authenticateToken);

// Routes
router.get('/dashboard/:user_id', getDashboardSummary);
router.get('/dashboard', getDashboardSummary);
router.get('/summary/:user_id', getDashboardSummary);
router.get('/summary', getDashboardSummary);
router.get('/summary-data/:user_id', getDashboardSummary);
router.get('/summary-data', getDashboardSummary);
router.get('/monthly/:user_id', getMonthlyReport);
router.get('/annual/:user_id', getAnnualReport);
router.get('/summary/monthly/:user_id', getMonthlySummary);
router.get('/budget-vs-actual/:user_id', getBudgetVsActual);

module.exports = router;
