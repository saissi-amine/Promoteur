const { supabase, supabaseAdmin } = require('../config/supabase');

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
 * Créer une nouvelle tâche
 * Réservé aux Promoteurs et Admins
 */
exports.createTask = async (req, res) => {
  const { title, description, assigned_to, due_date } = req.body;
  const { id: userId } = req.user;
  const clientToUse = supabaseAdmin || supabase;

  if (!title) {
    return res.status(400).json({ error: 'Le titre de la tâche est obligatoire.' });
  }

  try {
    // Si assigned_to est spécifié, on vérifie que c'est bien un ingénieur
    if (assigned_to) {
      const { data: profile, error: profileError } = await clientToUse
        .from('profiles')
        .select('role')
        .eq('id', assigned_to)
        .single();

      if (profileError || !profile) {
        return res.status(400).json({ error: 'L\'utilisateur assigné n\'existe pas.' });
      }

      if (profile.role !== 'ingenieur') {
        return res.status(400).json({ error: 'Une tâche ne peut être assignée qu\'à un ingénieur.' });
      }
    }

    const { data: task, error } = await clientToUse
      .from('tasks')
      .insert([
        {
          title,
          description,
          assigned_to: assigned_to || null,
          created_by: userId,
          due_date: due_date || null
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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
 * Mettre à jour le statut d'une tâche
 * Ingénieur (si assignée) ou Promoteur/Admin
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
    // Récupérer la tâche pour vérifier l'assignation
    const { data: task, error: fetchError } = await clientToUse
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Tâche introuvable.' });
    }

    // Vérification des droits d'accès
    // Si l'utilisateur est ingénieur, il doit être l'assigné de la tâche
    if (role === 'ingenieur' && task.assigned_to !== userId) {
      return res.status(403).json({ error: 'Accès interdit. Vous ne pouvez mettre à jour que vos propres tâches.' });
    }

    // Si c'est un client ou commercial, il n'a pas le droit d'éditer
    if (role === 'client' || role === 'commercial') {
      return res.status(403).json({ error: 'Accès interdit. Vous n\'avez pas les droits de modification sur les tâches.' });
    }

    // Mise à jour de la tâche
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
