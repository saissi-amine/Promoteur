const { supabase } = require('../config/supabase');

/**
 * Inscription d'un nouvel utilisateur
 */
exports.register = async (req, res) => {
  const { email, password, role, fullName, phone } = req.body;

  // Validation minimale
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'L\'email, le mot de passe et le rôle sont obligatoires.' });
  }

  // Vérification des rôles valides
  const validRoles = ['admin', 'promoteur', 'ingenieur', 'commercial', 'client'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Rôle invalide. Rôles acceptés : ${validRoles.join(', ')}` });
  }

  try {
    // Inscription dans Supabase Auth avec métadonnées utilisateur
    // Le trigger PostgreSQL (on_auth_user_created) créera automatiquement le profil dans public.profiles
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
          phone: phone || '',
          role: role
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data.user) {
      return res.status(400).json({ error: 'Une erreur inconnue est survenue lors de l\'inscription.' });
    }

    res.status(201).json({
      message: 'Utilisateur inscrit avec succès.',
      user: {
        id: data.user.id,
        email: data.user.email,
        role: role,
        fullName: fullName || '',
        phone: phone || ''
      }
    });
  } catch (err) {
    console.error('Erreur inscription:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de l\'inscription.' });
  }
};

/**
 * Connexion d'un utilisateur
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'L\'email et le mot de passe sont obligatoires.' });
  }

  try {
    // Connexion avec Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Récupérer le profil utilisateur depuis public.profiles pour confirmer son rôle
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ 
        error: 'Utilisateur authentifié mais profil introuvable dans la base de données public.' 
      });
    }

    res.status(200).json({
      message: 'Connexion réussie.',
      token: data.session.access_token,
      expiresAt: data.session.expires_at,
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
        phone: profile.phone
      }
    });
  } catch (err) {
    console.error('Erreur connexion:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la connexion.' });
  }
};
