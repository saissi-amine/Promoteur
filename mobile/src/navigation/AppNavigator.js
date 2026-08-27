import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Écrans d'authentification
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Écrans des Tableaux de bord
import PromoterDashboard from '../screens/dashboards/PromoterDashboard';
import EngineerDashboard from '../screens/dashboards/EngineerDashboard';
import CommercialDashboard from '../screens/dashboards/CommercialDashboard';
import ClientDashboard from '../screens/dashboards/ClientDashboard';
import AdminDashboard from '../screens/dashboards/AdminDashboard';

// Écran commun
import ProfileScreen from '../screens/common/ProfileScreen';

const Stack = createStackNavigator();

// Composant pour orienter dynamiquement l'utilisateur vers son tableau de bord par défaut
function HomeWrapper({ navigation, route }) {
  const { user } = useContext(AuthContext);
  
  if (!user) return <LoginScreen navigation={navigation} route={route} />;

  switch (user.role) {
    case 'promoteur':
      return <PromoterDashboard navigation={navigation} route={route} />;
    case 'ingenieur':
      return <EngineerDashboard navigation={navigation} route={route} />;
    case 'commercial':
      return <CommercialDashboard navigation={navigation} route={route} />;
    case 'client':
      return <ClientDashboard navigation={navigation} route={route} />;
    case 'admin':
      return <AdminDashboard navigation={navigation} route={route} />;
    default:
      return <LoginScreen navigation={navigation} route={route} />;
  }
}

export default function AppNavigator() {
  const { user, token, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          cardStyle: { backgroundColor: colors.background },
        }}
      >
        {token === null ? (
          // Écrans pour les utilisateurs non connectés
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen} 
              options={{ 
                title: "Créer un compte",
                headerBackTitleVisible: false 
              }} 
            />
          </>
        ) : (
          // Écrans accessibles une fois connecté
          <>
            <Stack.Screen 
              name="Home" 
              component={HomeWrapper} 
              options={{ 
                title: "Accueil",
                headerShown: false // Le header sera géré directement dans chaque Dashboard pour un aspect premium
              }} 
            />
            
            {/* Écrans de rôles réutilisables ou accessibles via d'autres tableaux de bord */}
            <Stack.Screen 
              name="PromoterDashboard" 
              component={PromoterDashboard} 
              options={{ title: "Espace Promoteur" }} 
            />
            <Stack.Screen 
              name="EngineerDashboard" 
              component={EngineerDashboard} 
              options={{ title: "Espace Ingénieur" }} 
            />
            <Stack.Screen 
              name="CommercialDashboard" 
              component={CommercialDashboard} 
              options={{ title: "Espace Commercial" }} 
            />
            <Stack.Screen 
              name="ClientDashboard" 
              component={ClientDashboard} 
              options={{ title: "Espace Client" }} 
            />
            <Stack.Screen 
              name="AdminDashboard" 
              component={AdminDashboard} 
              options={{ title: "Dashboard Admin" }} 
            />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{ title: "Mon Profil" }} 
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
