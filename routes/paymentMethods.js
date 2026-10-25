const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getPaymentMethods } = require('../controllers/paymentMethodsController');

// All payment methods routes require valid authentication
router.use(authenticateToken);

router.get('/', getPaymentMethods);

module.exports = router;