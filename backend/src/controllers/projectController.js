const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Récupérer tous les projets immobiliers
 */
exports.getProjects = async (req, res) => {
  const clientToUse = supabaseAdmin || supabase;
  try {
    const { data: projects, error } = await clientToUse
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ projects });
  } catch (err) {
    console.error('Erreur getProjects:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des projets.' });
  }
};

/**
 * Créer un nouveau projet (Promoteur & Admin)
 */
exports.createProject = async (req, res) => {
  const { name, description, location, latitude, longitude } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  if (!name) {
    return res.status(400).json({ error: 'Le nom du projet est obligatoire.' });
  }

  try {
    const { data: project, error } = await clientToUse
      .from('projects')
      .insert([{ name, description, location, latitude, longitude }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'Projet créé avec succès.', project });
  } catch (err) {
    console.error('Erreur createProject:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la création du projet.' });
  }
};

/**
 * Récupérer tous les lots d'un projet spécifique
 */
exports.getLotsByProject = async (req, res) => {
  const { projectId } = req.params;
  const clientToUse = supabaseAdmin || supabase;

  try {
    const { data: lots, error } = await clientToUse
      .from('lots')
      .select(`
        *,
        client:profiles!lots_client_id_fkey(id, email, full_name, phone),
        commercial:profiles!lots_commercial_id_fkey(id, email, full_name, phone)
      `)
      .eq('project_id', projectId)
      .order('number', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ lots });
  } catch (err) {
    console.error('Erreur getLotsByProject:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des lots.' });
  }
};

/**
 * Récupérer la liste complète des lots (Tous projets confondus)
 */
exports.getAllLots = async (req, res) => {
  const clientToUse = supabaseAdmin || supabase;
  try {
    const { data: lots, error } = await clientToUse
      .from('lots')
      .select(`
        *,
        project:projects(id, name),
        client:profiles!lots_client_id_fkey(id, email, full_name, phone),
        commercial:profiles!lots_commercial_id_fkey(id, email, full_name, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ lots });
  } catch (err) {
    console.error('Erreur getAllLots:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des lots.' });
  }
};

/**
 * Créer un lot dans un projet (Promoteur & Admin)
 */
exports.createLot = async (req, res) => {
  const { project_id, number, type, price } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  if (!project_id || !number || !type || !price) {
    return res.status(400).json({ error: 'Les champs project_id, number, type et price sont obligatoires.' });
  }

  try {
    const { data: lot, error } = await clientToUse
      .from('lots')
      .insert([{ project_id, number, type, price, status: 'available' }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'Lot créé avec succès.', lot });
  } catch (err) {
    console.error('Erreur createLot:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la création du lot.' });
  }
};

/**
 * Mettre à jour le statut et l'affectation d'un lot (Commercial / Promoteur / Admin)
 * ex: Réserver un lot pour un client ou le vendre.
 */
exports.updateLotStatus = async (req, res) => {
  const { id } = req.params;
  const { status, client_id, price } = req.body;
  const clientToUse = supabaseAdmin || supabase;

  const validStatuses = ['available', 'reserved', 'sold'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Statut de lot invalide. Valeurs acceptées : ${validStatuses.join(', ')}` });
  }

  try {
    const updateData = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (price) updateData.price = price;
    
    // Si on réserve ou vend, on associe le commercial connecté si ce n'est pas déjà fait
    if (status === 'reserved' || status === 'sold') {
      if (client_id) updateData.client_id = client_id;
      if (req.user.role === 'commercial') {
        updateData.commercial_id = req.user.id;
      }
    } else if (status === 'available') {
      // Libérer le lot
      updateData.client_id = null;
      updateData.commercial_id = null;
    }

    const { data: lot, error } = await clientToUse
      .from('lots')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'Statut du lot mis à jour avec succès.', lot });
  } catch (err) {
    console.error('Erreur updateLotStatus:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du lot.' });
  }
};

/**
 * Récupérer les détails d'un projet spécifique avec sa hiérarchie de tâches
 */
exports.getProjectDetail = async (req, res) => {
  const { id } = req.params;
  const clientToUse = supabaseAdmin || supabase;

  try {
    // 1. Fetch project header info
    const { data: project, error: projError } = await clientToUse
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projError || !project) {
      return res.status(404).json({ error: 'Projet introuvable.' });
    }

    // 2. Fetch assigned engineers
    const { data: engAssignments, error: engError } = await clientToUse
      .from('project_engineers')
      .select('*')
      .eq('project_id', id);

    let assignedEngineers = [];
    if (!engError && engAssignments) {
      // Map assignments to get engineer details (handles joins gracefully)
      assignedEngineers = engAssignments.map(assignment => {
        return assignment.engineer || assignment.engineers || { id: assignment.engineer_id };
      }).filter(e => e.id);
    }

    // 3. Fetch all tasks for the project
    const { data: tasks, error: tasksError } = await clientToUse
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true });

    if (tasksError) {
      return res.status(400).json({ error: tasksError.message });
    }

    // 4. Build task hierarchy (max 3 levels)
    const buildTaskTree = (flatTasks) => {
      if (!flatTasks || flatTasks.length === 0) return [];
      
      // Separate by levels
      const l1 = flatTasks.filter(t => t.level === 1 || !t.parent_id);
      const l2 = flatTasks.filter(t => t.level === 2);
      const l3 = flatTasks.filter(t => t.level === 3);

      // Nest Level 3 into Level 2
      l2.forEach(task2 => {
        task2.subtasks = l3.filter(task3 => task3.parent_id === task2.id);
      });

      // Nest Level 2 into Level 1
      l1.forEach(task1 => {
        task1.subtasks = l2.filter(task2 => task2.parent_id === task1.id);
      });

      return l1;
    };

    const taskTree = buildTaskTree(tasks);

    res.status(200).json({
      project: {
        ...project,
        assigned_engineers: assignedEngineers,
        engineers_count: assignedEngineers.length
      },
      taskTree
    });

  } catch (err) {
    console.error('Erreur getProjectDetail:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des détails du projet.' });
  }
};
