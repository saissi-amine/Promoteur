const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/', paymentController.getPayments);
router.get('/gauge', paymentController.getPaymentGauge);
router.post('/:id/pay', requireRoles(['promoteur', 'admin']), paymentController.registerPayment);

module.exports = router;
