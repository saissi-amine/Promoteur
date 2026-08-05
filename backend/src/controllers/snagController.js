const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Récupérer la liste des réserves (Snags / SAV) selon les rôles
 */
exports.getSnags = async (req, res) => {
  const { id: userId, role } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  try {
    let query = clientToUse.from('snag_issues').select(`
      *,
      lot:lots(id, number, type, project:projects(id, name))
    `);

    // Règle d'accès
    if (role === 'client') {
      // Le client ne voit que les réserves associées aux lots qu'il a achetés
      const { data: clientLots, error: lotsErr } = await clientToUse
        .from('lots')
        .select('id')
        .eq('client_id', userId);

      if (lotsErr) return res.status(400).json({ error: lotsErr.message });
      const lotIds = clientLots.map(l => l.id);
      query = query.in('lot_id', lotIds);
    }

    const { data: snags, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ snags });
  } catch (err) {
    console.error('Erreur getSnags:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des réserves.' });
  }
};

/**
 * Créer une réserve avec photo sur chantier (Ingénieur / Promoteur / Admin)
 * Supporte le transfert de photo en base64 pour faciliter l'intégration mobile sans multipart/form-data.
 */
exports.createSnag = async (req, res) => {
  const { lot_id, title, description, severity, subcontractor, photoBase64 } = req.body;
  const { id: userId } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  if (!lot_id || !title) {
    return res.status(400).json({ error: 'Le lot_id et le titre de la réserve sont obligatoires.' });
  }

  try {
    let photoUrl = null;

    // Traitement de l'upload de photo si transmise en base64
    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `snag_${lot_id}_${Date.now()}.jpg`;

      const { data, error: uploadError } = await clientToUse.storage
        .from('site-photos')
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.warn("Échec d'upload de la photo de réserve. Raison :", uploadError.message);
      }

      const { data: urlData } = clientToUse.storage
        .from('site-photos')
        .getPublicUrl(filename);
      
      photoUrl = urlData?.publicUrl || `https://supabase.co/storage/v1/object/public/site-photos/${filename}`;
    }

    // Insérer la réserve
    const { data: snag, error } = await clientToUse
      .from('snag_issues')
      .insert([{
        lot_id,
        title,
        description,
        severity: severity || 'medium',
        status: 'open',
        reported_by: userId,
        subcontractor: subcontractor || null,
        photo_url: photoUrl
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'Réserve de chantier enregistrée.', snag });
  } catch (err) {
    console.error('Erreur createSnag:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la création de la réserve.' });
  }
};

/**
 * Mettre à jour le statut d'une réserve (Ingénieur / Promoteur / Admin)
 * ex: Fermer la réserve ou assigner un sous-traitant
 */
exports.updateSnag = async (req, res) => {
  const { id } = req.params;
  const { status, subcontractor, assigned_to } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}` });
  }

  try {
    const updateData = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (subcontractor) updateData.subcontractor = subcontractor;
    if (assigned_to) updateData.assigned_to = assigned_to;

    const { data: snag, error } = await clientToUse
      .from('snag_issues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'Réserve mise à jour avec succès.', snag });
  } catch (err) {
    console.error('Erreur updateSnag:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la réserve.' });
  }
};
