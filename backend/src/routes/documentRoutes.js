const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/', documentController.getDocuments);
router.post('/generate-reservation', requireRoles(['commercial', 'promoteur', 'admin']), documentController.generateReservationDoc);

module.exports = router;
