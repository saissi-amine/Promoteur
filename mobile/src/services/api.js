import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * URL de base pour communiquer avec l'API backend Express.
 * - Sur simulateur iOS: localhost fonctionnera.
 * - Sur émulateur Android: 10.0.2.2 pointe vers la machine hôte.
 * - Sur appareil physique: Remplacer par l'adresse IP locale de votre ordinateur (ex: http://192.168.1.X:5000)
 */
export let API_BASE_URL = Platform.select({
  ios: 'http://192.168.11.173:5000/api',
  android: 'http://192.168.11.173:5000/api',
  default: 'http://192.168.11.173:5000/api',
});

// Charger l'URL configurée au démarrage de l'application
AsyncStorage.getItem('api_base_url').then(savedUrl => {
  if (savedUrl) {
    API_BASE_URL = savedUrl;
  }
});

export const updateApiBaseUrl = async (newUrl) => {
  API_BASE_URL = newUrl;
  await AsyncStorage.setItem('api_base_url', newUrl);
};

// Helper pour formater les en-têtes HTTP avec le token JWT si présent
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Requête générique POST
const postRequest = async (endpoint, body) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue.');
  }
  return data;
};

// Requête générique GET
const getRequest = async (endpoint) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers,
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue.');
  }
  return data;
};

// Requête générique PATCH
const patchRequest = async (endpoint, body) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue.');
  }
  return data;
};

// Services d'API Exportés
export const api = {
  // Authentification
  login: (email, password) => postRequest('/auth/login', { email, password }),
  register: (email, password, role, fullName, phone) => 
    postRequest('/auth/register', { email, password, role, fullName, phone }),
  
  // Tâches (Tasks)
  getTasks: () => getRequest('/tasks'),
  createTask: (taskData) => postRequest('/tasks', taskData),
  updateTaskStatus: (taskId, status) => patchRequest(`/tasks/${taskId}/status`, { status }),
  
  // Projets & Lots
  getProjects: () => getRequest('/projects'),
  createProject: (projectData) => postRequest('/projects', projectData),
  getLotsByProject: (projectId) => getRequest(`/projects/${projectId}/lots`),
  getAllLots: () => getRequest('/projects/lots/all'),
  updateLotStatus: (lotId, status, clientId) => patchRequest(`/projects/lots/${lotId}/status`, { status, client_id: clientId }),
  
  // Jalons (Milestones)
  getMilestones: (projectId) => getRequest(`/milestones/${projectId}`),
  validateMilestone: (milestoneId) => postRequest(`/milestones/${milestoneId}/validate`, {}),
  
  // Paiements
  getPayments: () => getRequest('/payments'),
  getPaymentGauge: (clientId) => getRequest(`/payments/gauge${clientId ? '?clientId=' + clientId : ''}`),
  registerPayment: (paymentId) => postRequest(`/payments/${paymentId}/pay`, {}),
  
  // Documents (Coffre-fort numérique)
  getDocuments: () => getRequest('/documents'),
  generateReservationDoc: (lotId, clientId) => postRequest('/documents/generate-reservation', { lotId, clientId }),
  
  // Réserves / SAV (Snags)
  getSnags: () => getRequest('/snags'),
  createSnag: (snagData) => postRequest('/snags', snagData),
  updateSnag: (snagId, updateData) => patchRequest(`/snags/${snagId}`, updateData),
  
  // Promoteur (Statistiques, Cashflow, RBAC)
  getPromoterTreasury: () => getRequest('/promoter/treasury'),
  assignProject: (projectId, profileId, assignedRole) => postRequest('/promoter/assign-project', { projectId, profileId, assignedRole }),
  
  // Simulation de Pages (RBAC Verification)
  getIngenieurPage: () => getRequest('/pages/ingenieur'),
  getCommercialPage: () => getRequest('/pages/commercial'),
  getClientPage: () => getRequest('/pages/client'),
  getPromoteurPage: () => getRequest('/pages/promoteur'),
  getAdminPage: () => getRequest('/pages/admin'),
  getApiBaseUrl: () => API_BASE_URL,
  updateApiBaseUrl: (newUrl) => updateApiBaseUrl(newUrl),
};
