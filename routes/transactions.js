const express = require('express');
const router = express.Router();
const {
  getAllTransactions,
  getTransactionsByUserId,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactionsController');

// Routes
router.get('/', getAllTransactions);
router.get('/user/:userId', getTransactionsByUserId);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
