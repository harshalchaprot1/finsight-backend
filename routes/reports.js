const express = require('express');
const router = express.Router();
const {
  getMonthlyReport,
  getAnnualReport,
  getMonthlySummary,
  getBudgetVsActual
} = require('../controllers/reportsController');

// Routes
router.get('/monthly/:user_id', getMonthlyReport);
router.get('/annual/:user_id', getAnnualReport);
router.get('/summary/monthly/:user_id', getMonthlySummary);
router.get('/budget-vs-actual/:user_id', getBudgetVsActual);

module.exports = router;
