const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Récupérer la liste des jalons d'un projet
 */
exports.getMilestones = async (req, res) => {
  const { projectId } = req.params;
  const clientToUse = supabaseAdmin || supabase;

  try {
    const { data: milestones, error } = await clientToUse
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ milestones });
  } catch (err) {
    console.error('Erreur getMilestones:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des jalons.' });
  }
};

/**
 * Créer un jalon de projet (Promoteur & Admin)
 */
exports.createMilestone = async (req, res) => {
  const { project_id, title, description, order_index } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  if (!project_id || !title) {
    return res.status(400).json({ error: 'Le project_id et le titre sont obligatoires.' });
  }

  try {
    const { data: milestone, error } = await clientToUse
      .from('milestones')
      .insert([{
        project_id,
        title,
        description,
        order_index: order_index || 0,
        progress_percent: 0,
        is_validated: false
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'Jalon créé avec succès.', milestone });
  } catch (err) {
    console.error('Erreur createMilestone:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la création du jalon.' });
  }
};

/**
 * Valider une étape / jalon de chantier (Ingénieur / Promoteur / Admin)
 * 1. Marque le jalon comme validé (is_validated = true, progress = 100%)
 * 2. Déclenche une demande de paiement pour chaque client ayant un lot vendu/réservé sur ce projet.
 */
exports.validateMilestone = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  try {
    // 1. Récupérer le jalon existant
    const { data: milestone, error: fetchError } = await clientToUse
      .from('milestones')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !milestone) {
      return res.status(404).json({ error: 'Jalon introuvable.' });
    }

    if (milestone.is_validated) {
      return res.status(400).json({ error: 'Ce jalon a déjà été validé.' });
    }

    // 2. Mettre à jour le jalon
    const { data: updatedMilestone, error: updateError } = await clientToUse
      .from('milestones')
      .update({
        is_validated: true,
        progress_percent: 100,
        validated_at: new Date().toISOString(),
        validated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // 3. Récupérer tous les lots vendus/réservés de ce projet pour appeler un paiement
    const { data: lots, error: lotsError } = await clientToUse
      .from('lots')
      .select('id, client_id, price, number')
      .eq('project_id', milestone.project_id)
      .not('client_id', 'is', null);

    if (lotsError) {
      console.error('Erreur de récupération des lots pour les appels de fonds:', lotsError.message);
    }

    // 4. Générer des appels de fonds (payments) d'une valeur de 10% du prix du lot pour ce jalon
    const createdPayments = [];
    if (lots && lots.length > 0) {
      for (const lot of lots) {
        const paymentAmount = Math.round(lot.price * 0.10); // 10% du prix du bien
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Échéance à 30 jours

        const { data: payment, error: paymentError } = await clientToUse
          .from('payments')
          .insert([{
            lot_id: lot.id,
            client_id: lot.client_id,
            amount: paymentAmount,
            status: 'pending',
            due_date: dueDate.toISOString().split('T')[0] // Format YYYY-MM-DD
          }])
          .select()
          .single();

        if (paymentError) {
          console.error(`Erreur d'appel de fonds pour le lot ${lot.number}:`, paymentError.message);
        } else {
          createdPayments.push(payment);
        }
      }
    }

    // Calculer le taux d'avancement global fictif du projet
    const { data: allMilestones, error: milestonesError } = await clientToUse
      .from('milestones')
      .select('progress_percent')
      .eq('project_id', milestone.project_id);

    let projectProgress = 0;
    if (allMilestones && allMilestones.length > 0) {
      const sum = allMilestones.reduce((acc, curr) => acc + Number(curr.progress_percent), 0);
      projectProgress = Math.round(sum / allMilestones.length);
    }

    res.status(200).json({
      message: 'Jalon validé avec succès. Appels de fonds de 10% générés.',
      milestone: updatedMilestone,
      projectProgress,
      paymentsGenerated: createdPayments.length,
      payments: createdPayments
    });
  } catch (err) {
    console.error('Erreur validateMilestone:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la validation du jalon.' });
  }
};
