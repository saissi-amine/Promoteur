const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const pageRoutes = require('./routes/pageRoutes');
const projectRoutes = require('./routes/projectRoutes');
const milestoneRoutes = require('./routes/milestoneRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const documentRoutes = require('./routes/documentRoutes');
const snagRoutes = require('./routes/snagRoutes');
const promoterRoutes = require('./routes/promoterRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des Middlewares de base
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Augmenté pour les photos base64 de chantier
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));  // Logs de requêtes HTTP

// Enregistrement des routes d'API
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/snags', snagRoutes);
app.use('/api/promoter', promoterRoutes);

// Route d'accueil pour tester le statut de l'API
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API de gestion immobilière (Backend Node.js/Express/Supabase) en cours de fonctionnement.',
    time: new Date()
  });
});

// Middleware de gestion des erreurs 404 (Route non trouvée)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route non trouvée.' });
});

// Middleware global de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ 
    error: 'Une erreur interne s\'est produite sur le serveur.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Démarrage du serveur
if (require.main === module || true) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`Serveur démarré sur le port : ${PORT}`);
    console.log(`URL de base : http://localhost:${PORT}`);
    console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
