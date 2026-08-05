import React, { useContext, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../services/api';
import { colors } from '../../theme/colors';

export default function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);
  const [apiUrl, setApiUrl] = useState(api.getApiBaseUrl());
  const [isEditingApi, setIsEditingApi] = useState(false);

  if (!user) return null;

  // Récupérer la couleur associée au rôle pour l'afficher sur le badge
  const roleColor = colors.roles[user.role] || colors.primary;

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Erreur', 'L\'adresse de l\'API ne peut pas être vide.');
      return;
    }
    try {
      await api.updateApiBaseUrl(apiUrl.trim());
      setIsEditingApi(false);
      Alert.alert('Succès', 'L\'adresse de l\'API a été mise à jour avec succès.');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'adresse de l\'API.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          
          {/* 1. ENTETE DE PROFIL */}
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: roleColor }]}>
              <Text style={styles.avatarText}>
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.name}>{user.fullName || 'Utilisateur'}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '20', borderColor: roleColor }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>
                {user.role.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* 2. LISTE : MES INFORMATIONS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes Informations</Text>
            
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Téléphone</Text>
                <Text style={styles.infoValue}>{user.phone || 'Non renseigné'}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ID Utilisateur</Text>
                <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
                  {user.id}
                </Text>
              </View>
            </View>
          </View>

          {/* 3. LISTE : PARAMETRES DES SERVICES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Paramètres des Services</Text>
            
            <View style={styles.card}>
              <View style={styles.serviceRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.infoLabel}>Adresse Serveur API</Text>
                  {isEditingApi ? (
                    <TextInput
                      style={styles.apiInput}
                      value={apiUrl}
                      onChangeText={setApiUrl}
                      placeholder="http://192.168.1.X:5000/api"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  ) : (
                    <Text style={styles.apiValueText}>{apiUrl}</Text>
                  )}
                </View>

                {isEditingApi ? (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.miniBtn, { backgroundColor: colors.success }]} 
                      onPress={handleSaveApiUrl}
                    >
                      <Text style={styles.miniBtnText}>OK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.miniBtn, { backgroundColor: colors.border }]} 
                      onPress={() => {
                        setApiUrl(api.getApiBaseUrl());
                        setIsEditingApi(false);
                      }}
                    >
                      <Text style={styles.miniBtnText}>X</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.editBtn} 
                    onPress={() => setIsEditingApi(true)}
                  >
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Statut Supabase</Text>
                <View style={styles.statusContainer}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Simulation / Connecté</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 4. ACTIONS / DECONNEXION */}
          <View style={styles.logoutContainer}>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutButtonText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  apiValueText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  apiInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 14,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  editBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  logoutContainer: {
    marginTop: 35,
    marginBottom: 20,
  },
  logoutButton: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
