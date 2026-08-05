const express = require('express');
const router = express.Router();
const snagController = require('../controllers/snagController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/', snagController.getSnags);
router.post('/', requireRoles(['ingenieur', 'promoteur', 'admin']), snagController.createSnag);
router.patch('/:id', requireRoles(['ingenieur', 'promoteur', 'admin']), snagController.updateSnag);

module.exports = router;
