const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Calculer les statistiques de trésorerie et prévisions de cash-flow (Promoteur & Admin)
 * 1. Revenu global accumulé vs encaissé vs en retard
 * 2. Liste détaillée des impayés (Overdue Tracker)
 * 3. Prévisions mensuelles de trésorerie sur les 6 prochains mois
 */
exports.getTreasuryData = async (req, res) => {
  const clientToUse = supabaseAdmin || supabase;

  try {
    // 1. Récupérer tous les paiements enregistrés
    const { data: payments, error: paymentsErr } = await clientToUse
      .from('payments')
      .select(`
        *,
        client:profiles!payments_client_id_fkey(id, email, full_name, phone),
        lot:lots(id, number, type, price, project:projects(id, name))
      `);

    if (paymentsErr) {
      return res.status(400).json({ error: paymentsErr.message });
    }

    const today = new Date().toISOString().split('T')[0];

    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOverdue = 0;
    let totalPending = 0;
    const overdueList = [];

    // Table de hachage pour grouper par mois les rentrées d'argent futures
    const monthlyForecast = {};

    payments.forEach(payment => {
      const amount = Number(payment.amount);
      totalInvoiced += amount;

      // Vérifier le statut effectif du paiement
      const isOverdue = payment.status === 'overdue' || (payment.status === 'pending' && payment.due_date < today);

      if (payment.status === 'paid') {
        totalCollected += amount;
      } else if (isOverdue) {
        totalOverdue += amount;
        overdueList.push(payment);
      } else {
        totalPending += amount;
      }

      // Pour la prévision de cash-flow: on s'intéresse aux paiements non encore encaissés
      if (payment.status !== 'paid') {
        const monthKey = payment.due_date.substring(0, 7); // 'YYYY-MM'
        monthlyForecast[monthKey] = (monthlyForecast[monthKey] || 0) + amount;
      }
    });

    // Transformer les prévisions en tableau ordonné
    const forecastArray = Object.keys(monthlyForecast)
      .map(month => ({
        month,
        amount: monthlyForecast[month]
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(0, 6); // Limiter aux 6 mois les plus proches

    // 2. Statistiques globales par projet (Chantier vs Lots)
    const { data: projects, error: projectsErr } = await clientToUse.from('projects').select('id, name');
    const { data: lots, error: lotsErr } = await clientToUse.from('lots').select('id, status, price, project_id');

    const projectMetrics = [];
    if (projects && lots) {
      projects.forEach(p => {
        const projectLots = lots.filter(l => l.project_id === p.id);
        const totalLots = projectLots.length;
        const availableLots = projectLots.filter(l => l.status === 'available').length;
        const reservedLots = projectLots.filter(l => l.status === 'reserved').length;
        const soldLots = projectLots.filter(l => l.status === 'sold').length;

        const totalValue = projectLots.reduce((acc, curr) => acc + Number(curr.price), 0);
        const salesRevenue = projectLots
          .filter(l => l.status === 'sold' || l.status === 'reserved')
          .reduce((acc, curr) => acc + Number(curr.price), 0);

        projectMetrics.push({
          projectId: p.id,
          projectName: p.name,
          totalLots,
          availableLots,
          reservedLots,
          soldLots,
          totalValue,
          salesRevenue
        });
      });
    }

    res.status(200).json({
      treasury: {
        totalInvoiced,
        totalCollected,
        totalOverdue,
        totalPending,
        overdueTracker: overdueList
      },
      cashFlowForecast: forecastArray,
      projectsSummary: projectMetrics
    });
  } catch (err) {
    console.error('Erreur getTreasuryData:', err.message);
    res.status(500).json({ error: 'Erreur interne lors du calcul financier.' });
  }
};

/**
 * Assigner un commercial ou ingénieur à un projet (Promoteur & Admin)
 */
exports.assignUserToProject = async (req, res) => {
  const { projectId, profileId, assignedRole } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  if (!projectId || !profileId) {
    return res.status(400).json({ error: 'Le projectId et le profileId sont obligatoires.' });
  }

  try {
    // Vérifier que l'utilisateur ciblé existe
    const { data: profile, error: profileErr } = await clientToUse
      .from('profiles')
      .select('role')
      .eq('id', profileId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'Profil de l\'utilisateur assigné introuvable.' });
    }

    // Assigner à la table de jointure
    const { data: assignment, error } = await clientToUse
      .from('project_assignments')
      .insert([{
        project_id: projectId,
        profile_id: profileId,
        assigned_role: assignedRole || profile.role
      }])
      .select()
      .single();

    if (error) {
      // Gérer la contrainte d'unicité
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Cet utilisateur est déjà assigné à ce projet.' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Utilisateur affecté au projet avec succès.',
      assignment
    });
  } catch (err) {
    console.error('Erreur assignUserToProject:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de l\'affectation du projet.' });
  }
};
