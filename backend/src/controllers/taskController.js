const { supabase, supabaseAdmin } = require('../config/supabase');
const { recalculateProjectProgress } = require('../services/progressService');

/**
 * Récupérer la liste des tâches selon les permissions
 */
exports.getTasks = async (req, res) => {
  const { id: userId, role } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  try {
    let query = clientToUse.from('tasks').select(`
      id,
      title,
      description,
      status,
      due_date,
      created_at,
      assigned_to,
      assigned_profile:profiles!tasks_assigned_to_fkey(id, email, full_name, phone, role),
      created_profile:profiles!tasks_created_by_fkey(id, email, full_name, phone, role)
    `);

    // Règle d'accès:
    // Si l'utilisateur est un Ingénieur, il ne peut voir QUE ses propres tâches
    if (role === 'ingenieur') {
      query = query.eq('assigned_to', userId);
    } 
    // Si Promoteur ou Admin, ils peuvent tout voir.
    // Si Client ou Commercial, ils ont aussi accès en lecture à toutes les tâches d'après les spécifications d'accès global.
    
    const { data: tasks, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ tasks });
  } catch (err) {
    console.error('Erreur getTasks:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des tâches.' });
  }
};

/**
 * Créer une nouvelle tâche / sous-tâche (jusqu'à 3 niveaux)
 */
exports.createTask = async (req, res) => {
  const { title, description, assigned_to, target_date, project_id, parent_id, progress_percentage } = req.body;
  const { id: userId } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  if (!title) {
    return res.status(400).json({ error: 'Le titre de la tâche est obligatoire.' });
  }

  try {
    let resolvedProjectId = project_id;
    let level = 1;

    if (parent_id) {
      // Récupérer les détails de la tâche parente
      const { data: parentTask, error: parentError } = await clientToUse
        .from('tasks')
        .select('*')
        .eq('id', parent_id)
        .single();

      if (parentError || !parentTask) {
        return res.status(404).json({ error: 'Tâche parente introuvable.' });
      }

      resolvedProjectId = parentTask.project_id;
      level = (parentTask.level || 1) + 1;

      if (level > 3) {
        return res.status(400).json({ error: 'La hiérarchie des tâches ne peut pas dépasser 3 niveaux.' });
      }
    }

    if (!resolvedProjectId) {
      return res.status(400).json({ error: 'Le project_id est obligatoire pour les tâches racines.' });
    }

    // Si assigned_to est spécifié, on vérifie que c'est bien un ingénieur
    if (assigned_to) {
      const { data: profile, error: profileError } = await clientToUse
        .from('profiles')
        .select('role')
        .eq('id', assigned_to)
        .single();

      if (profileError || !profile) {
        return res.status(400).json({ error: "L'utilisateur assigné n'existe pas." });
      }

      if (profile.role !== 'ingenieur') {
        return res.status(400).json({ error: "Une tâche ne peut être assignée qu'à un ingénieur." });
      }
    }

    // Insérer la nouvelle tâche
    const { data: task, error: insertError } = await clientToUse
      .from('tasks')
      .insert([
        {
          project_id: resolvedProjectId,
          parent_id: parent_id || null,
          level,
          title,
          description: description || null,
          progress_percentage: Number(progress_percentage) || 0,
          target_date: target_date || null,
          assigned_to: assigned_to || null,
          created_by: userId,
          status: 'todo',
          last_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    // Recalculer le progrès du projet
    await recalculateProjectProgress(resolvedProjectId);

    res.status(201).json({
      message: 'Tâche créée avec succès.',
      task
    });
  } catch (err) {
    console.error('Erreur createTask:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la création de la tâche.' });
  }
};

/**
 * Mettre à jour une tâche
 */
exports.updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, progress_percentage, target_date, assigned_to, status } = req.body;
  const { role, id: userId } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  try {
    // 1. Récupérer la tâche
    const { data: task, error: fetchError } = await clientToUse
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Tâche introuvable.' });
    }

    // 2. Vérification des droits d'accès
    if (role === 'ingenieur' && task.assigned_to !== userId) {
      return res.status(403).json({ error: 'Accès interdit. Vous ne pouvez modifier que vos tâches assignées.' });
    }
    if (role === 'client' || role === 'commercial') {
      return res.status(403).json({ error: 'Accès interdit. Rôle non autorisé à modifier des tâches.' });
    }

    // 3. Préparer les données de mise à jour
    const updates = {
      last_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (target_date !== undefined) updates.target_date = target_date;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (status !== undefined) updates.status = status;

    if (progress_percentage !== undefined) {
      const percentage = Number(progress_percentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return res.status(400).json({ error: 'Le pourcentage doit être compris entre 0 et 100.' });
      }
      updates.progress_percentage = percentage;
    }

    // 4. Mettre à jour la tâche
    const { data: updatedTask, error: updateError } = await clientToUse
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // 5. Recalculer le progrès du projet
    await recalculateProjectProgress(task.project_id);

    // Récupérer la version finale après mise à jour récursive des parents
    const { data: finalTask } = await clientToUse
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    res.status(200).json({
      message: 'Tâche mise à jour avec succès.',
      task: finalTask || updatedTask
    });
  } catch (err) {
    console.error('Erreur updateTask:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la tâche.' });
  }
};

/**
 * Supprimer une tâche et cascade ses sous-tâches
 */
exports.deleteTask = async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  if (role !== 'promoteur' && role !== 'admin') {
    return res.status(403).json({ error: 'Accès interdit. Seuls les promoteurs et admins peuvent supprimer des tâches.' });
  }

  try {
    // 1. Récupérer la tâche
    const { data: task, error: fetchError } = await clientToUse
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Tâche introuvable.' });
    }

    // Supprimer récursivement pour le mode simulation/mock et SQL cascade
    const deleteRecursive = async (taskId) => {
      const { data: children } = await clientToUse
        .from('tasks')
        .select('id')
        .eq('parent_id', taskId);

      if (children && children.length > 0) {
        for (const child of children) {
          await deleteRecursive(child.id);
        }
      }
      await clientToUse.from('tasks').delete().eq('id', taskId);
    };

    // 2. Supprimer la tâche et ses enfants
    await deleteRecursive(id);

    // 3. Recalculer le progrès
    await recalculateProjectProgress(task.project_id);

    res.status(200).json({
      message: 'Tâche et ses sous-tâches supprimées avec succès.'
    });
  } catch (err) {
    console.error('Erreur deleteTask:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la suppression de la tâche.' });
  }
};

/**
 * Mettre à jour le statut d'une tâche (ancien comportement conservé pour la compatibilité)
 */
exports.updateTaskStatus = async (req, res) => {
  const { id: taskId } = req.params;
  const { status } = req.body;
  const { id: userId, role } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  const validStatuses = ['todo', 'in_progress', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Statuts acceptés : ${validStatuses.join(', ')}` });
  }

  try {
    const { data: task, error: fetchError } = await clientToUse
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Tâche introuvable.' });
    }

    if (role === 'ingenieur' && task.assigned_to !== userId) {
      return res.status(403).json({ error: 'Accès interdit. Vous ne pouvez mettre à jour que vos propres tâches.' });
    }

    if (role === 'client' || role === 'commercial') {
      return res.status(403).json({ error: 'Accès interdit. Vous n\'avez pas les droits de modification sur les tâches.' });
    }

    const { data: updatedTask, error: updateError } = await clientToUse
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.status(200).json({
      message: 'Statut de la tâche mis à jour avec succès.',
      task: updatedTask
    });
  } catch (err) {
    console.error('Erreur updateTaskStatus:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la tâche.' });
  }
};
