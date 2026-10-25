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

// All reports derive user identity strictly from authenticated JWT
router.get('/dashboard', getDashboardSummary);
router.get('/summary', getDashboardSummary);
router.get('/summary-data', getDashboardSummary);
router.get('/monthly', getMonthlyReport);
router.get('/annual', getAnnualReport);
router.get('/summary/monthly', getMonthlySummary);
router.get('/budget-vs-actual', getBudgetVsActual);

module.exports = router;
