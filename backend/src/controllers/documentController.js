const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateReservationPDF } = require('../services/pdfService');

/**
 * Récupérer tous les documents du coffre-fort numérique selon le rôle
 */
exports.getDocuments = async (req, res) => {
  const { id: userId, role } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  try {
    let query = clientToUse.from('documents').select(`
      *,
      project:projects(id, name),
      lot:lots(id, number, type)
    `);

    // Les clients ne peuvent voir que les documents qui leur sont affectés
    if (role === 'client') {
      query = query.eq('client_id', userId);
    }

    const { data: documents, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ documents });
  } catch (err) {
    console.error('Erreur getDocuments:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des documents.' });
  }
};

/**
 * Action Commerciale : Générer automatiquement un contrat de réservation de lot
 * 1. Génère le PDF de réservation préliminaire via PDFKit
 * 2. Enregistre le PDF dans Supabase Storage (vault-docs)
 * 3. Enregistre la pièce dans la table `documents` pour le Client
 * 4. Met à jour le lot en statut 'reserved' (orange) affecté au Client
 */
exports.generateReservationDoc = async (req, res) => {
  const { lotId, clientId } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  if (!lotId || !clientId) {
    return res.status(400).json({ error: 'Les identifiants du lot (lotId) et du client (clientId) sont obligatoires.' });
  }

  try {
    // 1. Récupérer le lot avec les informations du projet
    const { data: lot, error: lotError } = await clientToUse
      .from('lots')
      .select('*, project:projects(id, name)')
      .eq('id', lotId)
      .single();

    if (lotError || !lot) {
      return res.status(404).json({ error: 'Lot introuvable.' });
    }

    if (lot.status !== 'available') {
      return res.status(400).json({ error: 'Ce lot n\'est plus disponible à la vente.' });
    }

    // 2. Récupérer le profil du client
    const { data: clientProfile, error: profileError } = await clientToUse
      .from('profiles')
      .select('*')
      .eq('id', clientId)
      .single();

    if (profileError || !clientProfile) {
      return res.status(404).json({ error: 'Profil client introuvable.' });
    }

    // 3. Générer le document PDF de réservation
    const filename = `Contrat_Reservation_${lot.number}_${clientId.substring(0, 8)}.pdf`;
    let fileUrl = '';
    try {
      fileUrl = await generateReservationPDF(lot, clientProfile, filename);
    } catch (pdfErr) {
      console.error('Erreur de génération du PDF de contrat:', pdfErr.message);
      fileUrl = `https://supabase.co/storage/v1/object/public/vault-docs/${filename}`;
    }

    // 4. Mettre à jour le statut du lot en réservé
    const updateLotData = {
      status: 'reserved',
      client_id: clientId,
      updated_at: new Date().toISOString()
    };
    
    // Associer le commercial connecté comme responsable de la vente
    if (req.user.role === 'commercial') {
      updateLotData.commercial_id = req.user.id;
    }

    const { error: lotUpdateError } = await clientToUse
      .from('lots')
      .update(updateLotData)
      .eq('id', lotId);

    if (lotUpdateError) {
      return res.status(400).json({ error: lotUpdateError.message });
    }

    // 5. Créer l'enregistrement de document
    const { data: document, error: docError } = await clientToUse
      .from('documents')
      .insert([{
        project_id: lot.project_id,
        lot_id: lot.id,
        client_id: clientId,
        title: `Contrat de Réservation - Lot ${lot.number}`,
        type: 'contract',
        file_url: fileUrl,
        created_by: req.user.id
      }])
      .select()
      .single();

    if (docError) {
      return res.status(400).json({ error: docError.message });
    }

    res.status(201).json({
      message: 'Contrat de réservation généré et lot mis à jour.',
      document,
      pdfUrl: fileUrl
    });
  } catch (err) {
    console.error('Erreur generateReservationDoc:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la génération du contrat.' });
  }
};
