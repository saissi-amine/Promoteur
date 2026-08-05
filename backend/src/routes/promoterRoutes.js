const express = require('express');
const router = express.Router();
const promoterController = require('../controllers/promoterController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

router.use(requireAuth);
router.use(requireRoles(['promoteur', 'admin']));

router.get('/treasury', promoterController.getTreasuryData);
router.post('/assign-project', promoterController.assignUserToProject);

module.exports = router;
