const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/:projectId', milestoneController.getMilestones);
router.post('/', requireRoles(['promoteur', 'admin']), milestoneController.createMilestone);
router.post('/:id/validate', requireRoles(['ingenieur', 'promoteur', 'admin']), milestoneController.validateMilestone);

module.exports = router;
