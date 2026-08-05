const express = require('express');
const router = express.Router();
const { requireAuth, requireRoles } = require('../middlewares/auth');

// Toutes ces routes requièrent d'être connecté
router.use(requireAuth);

/**
 * Route pour simuler la page de l'Ingénieur
 * Accès : ingenieur, promoteur, client, admin
 * (Promoteur a accès à tout, Client a accès à ingénieur, Admin a accès à tout)
 */
router.get('/ingenieur', requireRoles(['ingenieur', 'promoteur', 'client', 'admin']), (req, res) => {
  res.status(200).json({
    message: "Accès autorisé à la page de l'Ingénieur.",
    role: req.user.role,
    data: {
      info: "Cette page contient les tâches techniques, les plans de chantier et l'état d'avancement des travaux.",
      actionsPermises: req.user.role === 'ingenieur' || req.user.role === 'promoteur' || req.user.role === 'admin' 
        ? ["Mettre à jour les tâches", "Consulter les rapports"]
        : ["Consulter uniquement"]
    }
  });
});

/**
 * Route pour simuler la page du Commercial
 * Accès : commercial, promoteur, client, admin
 * (Promoteur a accès à tout, Client a accès à commercial, Admin a accès à tout)
 */
router.get('/commercial', requireRoles(['commercial', 'promoteur', 'client', 'admin']), (req, res) => {
  res.status(200).json({
    message: "Accès autorisé à la page du Commercial.",
    role: req.user.role,
    data: {
      info: "Cette page contient les informations sur les ventes, les tarifs des lots, et les fiches clients.",
      actionsPermises: req.user.role === 'commercial' || req.user.role === 'promoteur' || req.user.role === 'admin'
        ? ["Créer des devis", "Enregistrer un client", "Voir les ventes"]
        : ["Consulter les prix et offres disponibles"]
    }
  });
});

/**
 * Route pour simuler la page du Client
 * Accès : client, promoteur, admin
 * (Promoteur a accès à tout, Admin a accès à tout)
 */
router.get('/client', requireRoles(['client', 'promoteur', 'admin']), (req, res) => {
  res.status(200).json({
    message: "Accès autorisé à la page Client.",
    role: req.user.role,
    data: {
      info: "Cette page contient votre dossier d'achat, vos paiements, et les documents contractuels.",
      actionsPermises: ["Télécharger le contrat", "Suivre les paiements"]
    }
  });
});

/**
 * Route pour le Dashboard Administrateur
 * Accès : Uniquement admin
 */
router.get('/admin', requireRoles(['admin']), (req, res) => {
  res.status(200).json({
    message: "Bienvenue sur le Dashboard Administrateur.",
    role: req.user.role,
    data: {
      info: "Statistiques système globales, gestion de tous les profils d'utilisateurs et logs d'activité.",
      stats: {
        totalUsers: 42,
        activeProjects: 5,
        systemStatus: "En ligne"
      }
    }
  });
});

/**
 * Route pour la page du Promoteur
 * Accès : Uniquement promoteur et admin (car promoteur gère le projet, admin supervise)
 */
router.get('/promoteur', requireRoles(['promoteur', 'admin']), async (req, res) => {
  try {
    const { supabase, supabaseAdmin } = require('../config/supabase');
    const clientToUse = supabaseAdmin || supabase;
    
    // Récupérer tous les profils qui ont le rôle d'ingénieur
    const { data: engineers, error } = await clientToUse
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'ingenieur');

    if (error) {
      console.error("Erreur de récupération des ingénieurs:", error.message);
    }

    res.status(200).json({
      message: "Bienvenue sur l'espace du Promoteur (Chef de Projet).",
      role: req.user.role,
      engineers: engineers || [],
      data: {
        info: "Cette page permet de piloter tout le projet immobilier, d'affecter des ingénieurs, de voir les ventes et de gérer les clients.",
        actionsPermises: ["Affecter un ingénieur", "Consulter toutes les tâches", "Suivre le chiffre d'affaires", "Valider les comptes"]
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la récupération des données promoteur." });
  }
});

module.exports = router;
