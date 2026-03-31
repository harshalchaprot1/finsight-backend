const express = require('express');
const router = express.Router();
const {
  getAllBudgets,
  getBudgetsByUserId,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget
} = require('../controllers/budgetsController');

// Routes
router.get('/', getAllBudgets);
router.get('/user/:userId', getBudgetsByUserId);
router.get('/:id', getBudgetById);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
