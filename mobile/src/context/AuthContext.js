import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger la session stockée au démarrage de l'application
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userProfile');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Erreur de restauration de la session:', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  // Action de connexion
  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const data = await api.login(email, password);
      
      const userToken = data.token;
      const userProfile = data.user;

      await AsyncStorage.setItem('userToken', userToken);
      await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

      setToken(userToken);
      setUser(userProfile);
      return { success: true };
    } catch (error) {
      console.error('Erreur AuthContext login:', error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Action d'inscription
  const register = async (email, password, role, fullName, phone) => {
    try {
      setIsLoading(true);
      const data = await api.register(email, password, role, fullName, phone);
      // L'inscription n'auto-connecte pas forcément si l'email doit être vérifié, 
      // mais ici le backend retourne l'utilisateur. Nous allons demander à l'utilisateur de se connecter.
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Erreur AuthContext register:', error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Action de déconnexion
  const logout = async () => {
    try {
      setIsLoading(true);
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userProfile');
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error('Erreur AuthContext logout:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        user,
        token,
        login,
        register,
        logout,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
