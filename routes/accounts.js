const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  archiveAccount
} = require('../controllers/accountsController');

// All account routes require valid authentication
router.use(authenticateToken);

router.get('/', getAllAccounts);
router.get('/:id', getAccountById);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', archiveAccount);

module.exports = router;