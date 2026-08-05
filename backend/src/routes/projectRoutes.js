const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

// Sécuriser toutes les routes avec l'authentification
router.use(requireAuth);

// Routes des Projets
router.get('/', projectController.getProjects);
router.post('/', requireRoles(['promoteur', 'admin']), projectController.createProject);

// Routes des Lots
router.get('/lots/all', projectController.getAllLots);
router.get('/:projectId/lots', projectController.getLotsByProject);
router.post('/lots', requireRoles(['promoteur', 'admin']), projectController.createLot);
router.patch('/lots/:id/status', requireRoles(['commercial', 'promoteur', 'admin']), projectController.updateLotStatus);

module.exports = router;
