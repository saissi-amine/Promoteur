const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { requireAuth, requireRoles } = require('../middlewares/auth');

// Toutes les routes de tâches nécessitent d'être connecté
router.use(requireAuth);

// Récupérer les tâches (Comportement différent selon le rôle: Ingénieur vs autres)
router.get('/', taskController.getTasks);

// Créer une tâche (Uniquement pour Promoteur et Admin)
router.post('/', requireRoles(['promoteur', 'admin']), taskController.createTask);

// Mettre à jour le statut d'une tâche (Ingénieur assigné, Promoteur ou Admin)
router.patch('/:id/status', requireRoles(['ingenieur', 'promoteur', 'admin']), taskController.updateTaskStatus);

module.exports = router;
