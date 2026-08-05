import React, { useState, useContext } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  SafeAreaView
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const ROLES = [
  { id: 'client', name: 'Client', color: colors.roles.client, desc: 'Acheteur / Suivi' },
  { id: 'promoteur', name: 'Promoteur', color: colors.roles.promoteur, desc: 'Chef de projet' },
  { id: 'ingenieur', name: 'Ingénieur', color: colors.roles.ingenieur, desc: 'Technique & Tâches' },
  { id: 'commercial', name: 'Commercial', color: colors.roles.commercial, desc: 'Ventes & Offres' },
];

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('client');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { register, isLoading } = useContext(AuthContext);

  const handleRegister = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName || !email || !password || !selectedRole) {
      setErrorMsg('Veuillez remplir les champs obligatoires (*).');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    const result = await register(email, password, selectedRole, fullName, phone);
    
    if (result.success) {
      setSuccessMsg('Compte créé avec succès ! Connectez-vous.');
      // Redirection rapide vers l'écran de connexion après 1.5s
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } else {
      setErrorMsg(result.error || 'Erreur lors de l\'inscription.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.card}>
            <Text style={styles.title}>Créer votre compte</Text>
            
            {errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom complet *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Amine Bennani"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: client@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: +212661000000"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe * (min. 6 car.)</Text>
              <TextInput
                style={styles.input}
                placeholder="Créer un mot de passe"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {/* Role Selector */}
            <View style={styles.roleSection}>
              <Text style={styles.label}>Choisissez votre rôle *</Text>
              <View style={styles.rolesGrid}>
                {ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleCard,
                        isSelected && { borderColor: role.color, backgroundColor: 'rgba(30, 41, 59, 0.5)' }
                      ]}
                      onPress={() => setSelectedRole(role.id)}
                    >
                      <View style={[styles.roleBadge, { backgroundColor: role.color }]} />
                      <Text style={[styles.roleName, isSelected && { color: role.color }]}>
                        {role.name}
                      </Text>
                      <Text style={styles.roleDesc}>{role.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textDark} />
              ) : (
                <Text style={styles.buttonText}>S'inscrire</Text>
              )}
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
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  roleCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  roleBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  roleName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  roleDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
