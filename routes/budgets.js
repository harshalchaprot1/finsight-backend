const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  getAllBudgets,
  getBudgetsByUserId,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget
} = require('../controllers/budgetsController');

// All budget operations require valid authentication
router.use(authenticateToken);

// Routes
router.get('/', getAllBudgets);
router.get('/user/:userId', getBudgetsByUserId);
router.get('/:id', getBudgetById);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
