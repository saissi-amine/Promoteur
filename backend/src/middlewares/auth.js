const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Middleware pour authentifier les utilisateurs à l'aide de leur token JWT Supabase.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Accès non autorisé. Jeton d\'authentification manquant.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Vérifier le token avec Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Jeton invalide ou expiré.' });
    }

    // Récupérer le profil et le rôle de l'utilisateur
    // On utilise supabaseAdmin pour être sûr de passer outre RLS si nécessaire
    const clientToUse = supabaseAdmin || supabase;
    const { data: profile, error: profileError } = await clientToUse
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profil utilisateur introuvable.' });
    }

    // Injecter les données utilisateur dans la requête
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      fullName: profile.full_name,
      phone: profile.phone
    };

    next();
  } catch (error) {
    console.error('Erreur Middleware requireAuth:', error.message);
    res.status(500).json({ error: 'Erreur interne du serveur lors de l\'authentification.' });
  }
}

/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC).
 * @param {Array<string>} allowedRoles - Liste des rôles autorisés à accéder à la ressource.
 */
function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié.' });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: `Accès interdit. Votre rôle '${userRole}' ne vous permet pas d'accéder à cette ressource.` 
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRoles
};
