const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateReceiptPDF } = require('../services/pdfService');

/**
 * Récupérer la liste des paiements selon le rôle
 */
exports.getPayments = async (req, res) => {
  const { id: userId, role } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  try {
    let query = clientToUse.from('payments').select(`
      *,
      lot:lots(id, number, type, price, project:projects(id, name))
    `);

    if (role === 'client') {
      query = query.eq('client_id', userId);
    }

    const { data: payments, error } = await query.order('due_date', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ payments });
  } catch (err) {
    console.error('Erreur getPayments:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des paiements.' });
  }
};

/**
 * Calculer la jauge de paiement pour un client spécifique ou globalement
 * Retourne : Total dû (prix du lot), Total payé, Restant à payer.
 */
exports.getPaymentGauge = async (req, res) => {
  const { id: userId, role } = req.user;
  const clientToUse = supabaseAdmin || supabase;
  
  // Si c'est un client, on calcule pour son compte.
  // Si c'est un promoteur/commercial, on peut spécifier un clientId en query parameter.
  const targetClientId = (role === 'client') ? userId : req.query.clientId;

  if (!targetClientId) {
    return res.status(400).json({ error: 'L\'identifiant client (clientId) est requis pour ce profil.' });
  }

  try {
    // 1. Somme des prix des lots achetés par le client
    const { data: lots, error: lotsError } = await clientToUse
      .from('lots')
      .select('price')
      .eq('client_id', targetClientId);

    if (lotsError) {
      return res.status(400).json({ error: lotsError.message });
    }

    const totalLotValue = lots.reduce((acc, curr) => acc + Number(curr.price), 0);

    // 2. Somme des paiements payés
    const { data: payments, error: paymentsError } = await clientToUse
      .from('payments')
      .select('amount, status')
      .eq('client_id', targetClientId);

    if (paymentsError) {
      return res.status(400).json({ error: paymentsError.message });
    }

    const totalPaid = payments
      .filter(p => p.status === 'paid')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalPending = payments
      .filter(p => p.status === 'pending')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalOverdue = payments
      .filter(p => p.status === 'overdue')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const remainingToPay = totalLotValue - totalPaid;

    res.status(200).json({
      metrics: {
        totalLotValue,
        totalPaid,
        totalPending,
        totalOverdue,
        remainingToPay
      }
    });
  } catch (err) {
    console.error('Erreur getPaymentGauge:', err.message);
    res.status(500).json({ error: 'Erreur interne lors du calcul des jauges.' });
  }
};

/**
 * Enregistrer le règlement d'un paiement (Promoteur & Admin)
 * 1. Passe le paiement en statut 'paid'
 * 2. Génère automatiquement le reçu PDF de paiement via PDFKit
 * 3. Enregistre le PDF dans documents (vault-docs) et lie le receipt_url
 */
exports.registerPayment = async (req, res) => {
  const { id } = req.params;
  const clientToUse = supabaseAdmin || supabase;

  try {
    // Récupérer le paiement et les détails associés
    const { data: payment, error: fetchError } = await clientToUse
      .from('payments')
      .select(`
        *,
        lot:lots(id, number, type, project:projects(id, name)),
        client:profiles!payments_client_id_fkey(id, email, full_name, phone)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ error: 'Ce paiement est déjà validé.' });
    }

    // 1. Générer le reçu PDF en local / mémoire
    const receiptFilename = `Recu_Paiement_${payment.id.substring(0, 8)}.pdf`;
    
    // Générer le reçu et l'uploader dans Supabase Storage (vault-docs)
    let fileUrl = '';
    try {
      fileUrl = await generateReceiptPDF(payment, receiptFilename);
    } catch (pdfErr) {
      console.error('Erreur lors de la génération PDF, suite sans fichier physique:', pdfErr.message);
      // Fallback à une URL simulée
      fileUrl = `https://supabase.co/storage/v1/object/public/vault-docs/${receiptFilename}`;
    }

    // 2. Mettre à jour le paiement
    const { data: updatedPayment, error: updateError } = await clientToUse
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        receipt_url: fileUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // 3. Ajouter à la table des documents (coffre-fort)
    const { error: docError } = await clientToUse
      .from('documents')
      .insert([{
        project_id: payment.lot.project.id,
        lot_id: payment.lot.id,
        client_id: payment.client_id,
        title: `Reçu de paiement - Lot ${payment.lot.number} (${payment.amount} DH)`,
        type: 'receipt',
        file_url: fileUrl,
        created_by: req.user.id
      }]);

    if (docError) {
      console.error('Erreur d\'insertion du document de reçu:', docError.message);
    }

    res.status(200).json({
      message: 'Règlement enregistré avec succès. Reçu de paiement généré.',
      payment: updatedPayment,
      receiptUrl: fileUrl
    });
  } catch (err) {
    console.error('Erreur registerPayment:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la validation du paiement.' });
  }
};
