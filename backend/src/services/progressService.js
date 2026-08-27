const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Recalculates the hierarchical completion percentage of tasks and the global project progress.
 * 
 * Hierarchy Logic:
 * - Level 3 tasks (leaves) use manual progress_percentage input (or default 0).
 * - Level 2 tasks progress = average of their Level 3 children (if any). If no children, keeps manual progress.
 * - Level 1 tasks progress = average of their Level 2 children (if any). If no children, keeps manual progress.
 * - Project global progress = average of all Level 1 tasks.
 * 
 * @param {string} projectId The UUID of the project to update
 */
exports.recalculateProjectProgress = async (projectId) => {
  const clientToUse = supabaseAdmin || supabase;
  
  try {
    // 1. Fetch all tasks for this project
    const { data: tasks, error: tasksError } = await clientToUse
      .from('tasks')
      .select('id, parent_id, level, progress_percentage')
      .eq('project_id', projectId);

    if (tasksError) {
      console.error('Error fetching tasks for progress recalculation:', tasksError.message);
      return;
    }

    if (!tasks || tasks.length === 0) {
      // No tasks remaining, project progress resets to 0
      await clientToUse
        .from('projects')
        .update({ 
          global_progress: 0, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', projectId);
      return;
    }

    // 2. Separate tasks by level
    const l1 = tasks.filter(t => t.level === 1);
    const l2 = tasks.filter(t => t.level === 2);
    const l3 = tasks.filter(t => t.level === 3);

    // 3. Create a progress map initialized with current values
    const progressMap = {};
    tasks.forEach(t => {
      progressMap[t.id] = Number(t.progress_percentage) || 0;
    });

    // 4. Calculate Level 2 progress from Level 3 children
    l2.forEach(task2 => {
      const children = l3.filter(task3 => task3.parent_id === task2.id);
      if (children.length > 0) {
        const sum = children.reduce((acc, child) => acc + (progressMap[child.id] || 0), 0);
        const avg = sum / children.length;
        progressMap[task2.id] = parseFloat(avg.toFixed(2));
      }
    });

    // 5. Calculate Level 1 progress from Level 2 children
    l1.forEach(task1 => {
      const children = l2.filter(task2 => task2.parent_id === task1.id);
      if (children.length > 0) {
        const sum = children.reduce((acc, child) => acc + (progressMap[child.id] || 0), 0);
        const avg = sum / children.length;
        progressMap[task1.id] = parseFloat(avg.toFixed(2));
      }
    });

    // 6. Calculate Project level global progress from Level 1 tasks
    let globalProgress = 0;
    if (l1.length > 0) {
      const sum = l1.reduce((acc, task1) => acc + (progressMap[task1.id] || 0), 0);
      const avg = sum / l1.length;
      globalProgress = parseFloat(avg.toFixed(2));
    }

    // 7. Update changed tasks in the database
    for (const task of tasks) {
      const computedProgress = progressMap[task.id];
      // Only update if the progress has changed
      if (computedProgress !== Number(task.progress_percentage)) {
        await clientToUse
          .from('tasks')
          .update({
            progress_percentage: computedProgress,
            last_updated_at: new Date().toISOString()
          })
          .eq('id', task.id);
      }
    }

    // 8. Update project global progress
    await clientToUse
      .from('projects')
      .update({
        global_progress: globalProgress,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    console.log(`Successfully recalculated progress for project ${projectId}. Global progress: ${globalProgress}%`);
  } catch (err) {
    console.error('Failed to recalculate project progress:', err.message);
  }
};
