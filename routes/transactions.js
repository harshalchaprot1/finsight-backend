const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  getAllTransactions,
  getTransactionsByUserId,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactionsController');

// All transaction operations require valid authentication
router.use(authenticateToken);

// Routes
router.get('/', getAllTransactions);
router.get('/user/:userId', getTransactionsByUserId);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
