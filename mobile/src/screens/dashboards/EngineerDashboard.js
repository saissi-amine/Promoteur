import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../services/api';
import { colors } from '../../theme/colors';

// Photo factice en Base64 représentative d'un constat de chantier (ex. plomberie défectueuse)
const MOCK_BASE64_PHOTO = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export default function EngineerDashboard({ navigation, route }) {
  const { user } = useContext(AuthContext);
  
  // États de l'interface
  const [activeTab, setActiveTab] = useState('milestones'); // 'milestones' ou 'snags'
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  
  // Données
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [snags, setSnags] = useState([]);
  const [lots, setLots] = useState([]);

  // États de saisie des réserves (Snags)
  const [selectedLotId, setSelectedLotId] = useState('');
  const [snagTitle, setSnagTitle] = useState('');
  const [snagDesc, setSnagDesc] = useState('');
  const [snagSeverity, setSnagSeverity] = useState('medium');
  const [subcontractor, setSubcontractor] = useState('plumber'); // plumber, electrician, painter
  const [attachedPhoto, setAttachedPhoto] = useState(null); // photo Base64
  
  // Indicateurs d'action
  const [actionLoading, setActionLoading] = useState(null);
  const [syncQueueLength, setSyncQueueLength] = useState(0);

  useEffect(() => {
    loadCachedData();
    fetchOnlineData();
    checkSyncQueue();
  }, [selectedProjectId]);

  // 1. CHARGEMENT HORS-LIGNE (AsyncStorage)
  const loadCachedData = async () => {
    try {
      const cachedProjects = await AsyncStorage.getItem('cachedProjects');
      const cachedMilestones = await AsyncStorage.getItem(`cachedMilestones_${selectedProjectId}`);
      const cachedSnags = await AsyncStorage.getItem('cachedSnags');
      const cachedLots = await AsyncStorage.getItem(`cachedLots_${selectedProjectId}`);

      if (cachedProjects) setProjects(JSON.parse(cachedProjects));
      if (cachedMilestones) setMilestones(JSON.parse(cachedMilestones));
      if (cachedSnags) setSnags(JSON.parse(cachedSnags));
      if (cachedLots) setLots(JSON.parse(cachedLots));
    } catch (err) {
      console.warn("Échec de chargement du cache local:", err.message);
    }
  };

  // 2. RÉCUPÉRATION EN LIGNE
  const fetchOnlineData = async () => {
    setLoading(true);
    try {
      // Vérifier le statut de connexion (Simulé ici par la réussite des appels)
      const projRes = await api.getProjects();
      setProjects(projRes.projects || []);
      await AsyncStorage.setItem('cachedProjects', JSON.stringify(projRes.projects));

      let currentProjId = selectedProjectId;
      if (!currentProjId && projRes.projects && projRes.projects.length > 0) {
        currentProjId = projRes.projects[0].id;
        setSelectedProjectId(currentProjId);
      }

      if (currentProjId) {
        // Récupérer les jalons du chantier
        const milestoneRes = await api.getMilestones(currentProjId);
        setMilestones(milestoneRes.milestones || []);
        await AsyncStorage.setItem(`cachedMilestones_${currentProjId}`, JSON.stringify(milestoneRes.milestones));

        // Récupérer les lots du projet pour pouvoir leur associer des réserves
        const lotsRes = await api.getLotsByProject(currentProjId);
        setLots(lotsRes.lots || []);
        await AsyncStorage.setItem(`cachedLots_${currentProjId}`, JSON.stringify(lotsRes.lots));
        if (lotsRes.lots && lotsRes.lots.length > 0) {
          setSelectedLotId(lotsRes.lots[0].id);
        }
      }

      // Récupérer les réserves (SAV)
      const snagsRes = await api.getSnags();
      setSnags(snagsRes.snags || []);
      await AsyncStorage.setItem('cachedSnags', JSON.stringify(snagsRes.snags));

      setIsOnline(true);
    } catch (err) {
      console.log("Mode hors-ligne détecté ou serveur injoignable. Passage en consultation locale.");
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // 3. GESTION DE LA FILE DE SYNCHRONISATION (OFFLINE QUEUE)
  const checkSyncQueue = async () => {
    try {
      const queue = JSON.parse(await AsyncStorage.getItem('offlineSyncQueue') || '[]');
      setSyncQueueLength(queue.length);
    } catch (err) {
      console.error(err);
    }
  };

  // Enregistrer une action dans la queue de synchronisation si hors-ligne
  const enqueueOfflineAction = async (actionType, endpoint, payload) => {
    try {
      const queue = JSON.parse(await AsyncStorage.getItem('offlineSyncQueue') || '[]');
      queue.push({
        id: Date.now().toString(),
        type: actionType,
        endpoint,
        payload,
        timestamp: new Date().toISOString()
      });
      await AsyncStorage.setItem('offlineSyncQueue', JSON.stringify(queue));
      setSyncQueueLength(queue.length);

      Alert.alert(
        'Action sauvegardée localement',
        'Vous êtes hors-ligne. Les modifications ont été stockées sur votre appareil et seront envoyées automatiquement dès le retour de la connexion.'
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Synchroniser manuellement la file
  const handleSyncQueue = async () => {
    setActionLoading('sync');
    try {
      const queue = JSON.parse(await AsyncStorage.getItem('offlineSyncQueue') || '[]');
      if (queue.length === 0) {
        Alert.alert('Info', 'Aucune modification locale en attente.');
        setActionLoading(null);
        return;
      }

      let successCount = 0;
      for (const item of queue) {
        try {
          if (item.type === 'validate_milestone') {
            await api.validateMilestone(item.payload.milestoneId);
          } else if (item.type === 'create_snag') {
            await api.createSnag(item.payload);
          }
          successCount++;
        } catch (itemErr) {
          console.error(`Erreur de synchronisation pour l'action ${item.id}:`, itemErr.message);
        }
      }

      // Nettoyer la file des éléments synchronisés avec succès
      const remainingQueue = queue.slice(successCount);
      await AsyncStorage.setItem('offlineSyncQueue', JSON.stringify(remainingQueue));
      setSyncQueueLength(remainingQueue.length);

      Alert.alert(
        'Synchronisation terminée',
        `${successCount} action(s) synchronisée(s) avec succès. ${remainingQueue.length} échec(s).`
      );

      fetchOnlineData();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de synchroniser pour le moment.');
    } finally {
      setActionLoading(null);
    }
  };

  // 4. ACTION : VALIDER UN JALON / ETAPE CHANTIER
  const handleValidateStep = async (milestoneId, title) => {
    Alert.alert(
      'Validation d\'étape',
      `Confirmez-vous que l'étape "${title}" est achevée ? Cette action mettra à jour la timeline du client et générera les demandes de paiements correspondantes.`,
      [
        {
          text: 'Valider',
          onPress: async () => {
            if (!isOnline) {
              // Sauvegarde en file hors-ligne
              // Mettre à jour l'état local de façon optimiste
              setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, is_validated: true, progress_percent: 100 } : m));
              await enqueueOfflineAction('validate_milestone', `/milestones/${milestoneId}/validate`, { milestoneId });
              return;
            }

            setActionLoading(milestoneId);
            try {
              const res = await api.validateMilestone(milestoneId);
              Alert.alert('Succès', `Étape validée. ${res.paymentsGenerated} appel(s) de fonds émis.`);
              fetchOnlineData();
            } catch (err) {
              Alert.alert('Erreur', err.message);
            } finally {
              setActionLoading(null);
            }
          }
        },
        { text: 'Annuler', style: 'cancel' }
      ]
    );
  };

  // 5. ACTION : CREER UNE RESERVE CHANTIER (SAV)
  const handleCreateSnag = async () => {
    if (!snagTitle) {
      Alert.alert('Erreur', 'Veuillez saisir le titre de la réserve.');
      return;
    }

    const payload = {
      lot_id: selectedLotId,
      title: snagTitle,
      description: snagDesc,
      severity: snagSeverity,
      subcontractor,
      photoBase64: attachedPhoto
    };

    if (!isOnline) {
      // Optimiste local
      const mockNewSnag = {
        id: `offline_${Date.now()}`,
        lot_id: selectedLotId,
        title: snagTitle,
        description: snagDesc,
        severity: snagSeverity,
        status: 'open',
        subcontractor,
        created_at: new Date().toISOString()
      };
      setSnags(prev => [mockNewSnag, ...prev]);
      await enqueueOfflineAction('create_snag', '/snags', payload);
      resetSnagForm();
      return;
    }

    setActionLoading('create_snag');
    try {
      await api.createSnag(payload);
      Alert.alert('Réserve enregistrée', 'La réserve de chantier a été envoyée et le sous-traitant affecté.');
      resetSnagForm();
      fetchOnlineData();
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setActionLoading('create_snag');
    }
  };

  const resetSnagForm = () => {
    setSnagTitle('');
    setSnagDesc('');
    setAttachedPhoto(null);
  };

  // Simuler la capture de photo
  const handleCapturePhoto = () => {
    setAttachedPhoto(MOCK_BASE64_PHOTO);
    Alert.alert('Photo capturée', 'Image de chantier jointe avec succès (simulation caméra en base64).');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.welcome}>Pilotage Chantier</Text>
          <Text style={styles.roleTitle} numberOfLines={1} ellipsizeMode="tail">
            Conducteur : {user?.fullName || user?.email}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={[styles.connectionBadge, isOnline ? styles.badgeOnline : styles.badgeOffline, { marginRight: 8 }]}
            onPress={() => {
              setIsOnline(!isOnline);
              Alert.alert('Statut Réseau', `Vous êtes passé en mode ${!isOnline ? 'En ligne' : 'Hors-ligne (Simulé)'}`);
            }}
          >
            <Text style={styles.connectionText}>{isOnline ? 'EN LIGNE 📶' : 'HORS-LIGNE 🚫'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileBtnText}>Profil</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync Banner */}
      {syncQueueLength > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{syncQueueLength} action(s) en attente de synchronisation.</Text>
          <TouchableOpacity 
            style={styles.syncBtn} 
            onPress={handleSyncQueue}
            disabled={actionLoading === 'sync'}
          >
            {actionLoading === 'sync' ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Synchroniser</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Project Selector */}
      <View style={styles.projectSelectorCard}>
        <Text style={styles.selectorLabel}>Chantier en cours de supervision :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectList}>
          {projects.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.projectTag, selectedProjectId === p.id && styles.projectTagActive]}
              onPress={() => setSelectedProjectId(p.id)}
            >
              <Text style={[styles.projectTagText, selectedProjectId === p.id && { color: colors.background }]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'milestones' && styles.tabButtonActive]}
          onPress={() => setActiveTab('milestones')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'milestones' && styles.tabButtonTextActive]}>Planning Gantt</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'snags' && styles.tabButtonActive]}
          onPress={() => setActiveTab('snags')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'snags' && styles.tabButtonTextActive]}>SAV & Réserves</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {activeTab === 'milestones' ? (
          /* TAB 1: GANTT / MILESTONES */
          <View>
            <Text style={styles.sectionHeader}>Étapes de construction du projet</Text>
            {loading ? (
              <ActivityIndicator color={colors.roles.ingenieur} style={{ marginVertical: 20 }} />
            ) : milestones.length === 0 ? (
              <Text style={styles.emptyText}>Aucune étape définie sur ce projet.</Text>
            ) : (
              milestones.map((item) => {
                const isUpdating = actionLoading === item.id;
                return (
                  <View key={item.id} style={styles.ganttCard}>
                    <View style={styles.ganttHeader}>
                      <Text style={styles.ganttTitle}>{item.title}</Text>
                      <Text style={[
                        styles.ganttStatus, 
                        item.is_validated ? { color: colors.success } : { color: colors.textMuted }
                      ]}>
                        {item.is_validated ? 'VALIDÉ ✓' : 'À FAIRE'}
                      </Text>
                    </View>
                    <Text style={styles.ganttDesc}>{item.description}</Text>
                    
                    {/* Barre de jalon */}
                    <View style={styles.ganttBarBg}>
                      <View style={[
                        styles.ganttBarFill,
                        { 
                          width: `${item.progress_percent}%`,
                          backgroundColor: item.is_validated ? colors.success : colors.roles.ingenieur 
                        }
                      ]} />
                    </View>

                    {!item.is_validated && (
                      <TouchableOpacity 
                        style={styles.validateBtn}
                        onPress={() => handleValidateStep(item.id, item.title)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <ActivityIndicator color={colors.background} size="small" />
                        ) : (
                          <Text style={styles.validateBtnText}>Achever & Lancer Appel de fonds</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* TAB 2: SNAG LIST (SAV) & CREATION WITH MEDIA */
          <View>
            {/* Formulaire de création de snag */}
            <View style={styles.formCard}>
              <Text style={styles.formHeader}>Signaler une réserve (SAV)</Text>
              
              <Text style={styles.inputLabel}>Lot affecté :</Text>
              <View style={styles.lotSelectorContainer}>
                {lots.map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.lotTag, selectedLotId === l.id && styles.lotTagActive]}
                    onPress={() => setSelectedLotId(l.id)}
                  >
                    <Text style={[styles.lotTagText, selectedLotId === l.id && { color: colors.background }]}>
                      Lot {l.number} ({l.type})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Titre de la réserve (ex: Fuite arrivée d'eau)"
                placeholderTextColor={colors.textMuted}
                value={snagTitle}
                onChangeText={setSnagTitle}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description du problème technique constaté..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={snagDesc}
                onChangeText={setSnagDesc}
              />

              <Text style={styles.inputLabel}>Corps d'état / Sous-traitant :</Text>
              <View style={styles.subcontractorRow}>
                {['plumber', 'electrician', 'painter'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.subTag, subcontractor === type && styles.subTagActive]}
                    onPress={() => setSubcontractor(type)}
                  >
                    <Text style={[styles.subTagText, subcontractor === type && { color: colors.background }]}>
                      {type === 'plumber' ? 'Plomberie' : type === 'electrician' ? 'Électricité' : 'Peinture'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Upload de média / Camera Trigger */}
              <TouchableOpacity style={styles.photoBtn} onPress={handleCapturePhoto}>
                <Text style={styles.photoBtnText}>
                  {attachedPhoto ? '📸 Photo chantier jointe (1)' : '📷 Prendre une photo de chantier'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleCreateSnag}
                disabled={actionLoading === 'create_snag'}
              >
                {actionLoading === 'create_snag' ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.submitBtnText}>Enregistrer la réserve</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Liste des snags existants */}
            <Text style={styles.sectionHeader}>Réserves et SAV actifs</Text>
            {snags.length === 0 ? (
              <Text style={styles.emptyText}>Aucune réserve enregistrée.</Text>
            ) : (
              snags.map((item) => (
                <View key={item.id} style={styles.snagCard}>
                  <View style={styles.snagHeader}>
                    <Text style={styles.snagTitle}>{item.title}</Text>
                    <View style={[styles.severityBadge, { borderColor: item.severity === 'high' ? colors.danger : colors.warning }]}>
                      <Text style={[styles.severityText, { color: item.severity === 'high' ? colors.danger : colors.warning }]}>
                        {item.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.snagDesc}>{item.description}</Text>
                  <Text style={styles.snagMeta}>
                    Affecté : {item.subcontractor === 'plumber' ? 'Plomberie' : item.subcontractor === 'electrician' ? 'Électricité' : 'Peinture'}
                  </Text>
                  <Text style={styles.snagMeta}>Statut : {item.status.toUpperCase()}</Text>
                  
                  {item.photo_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(item.photo_url)}>
                      <Text style={styles.photoLink}>🖼️ Voir la photo de chantier</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.roles.ingenieur,
  },
  roleTitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  connectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
  },
  badgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.roles.promoteur,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  syncBannerText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncBtn: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncBtnText: {
    color: colors.roles.promoteur,
    fontSize: 11,
    fontWeight: 'bold',
  },
  projectSelectorCard: {
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectorLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  projectList: {
    flexDirection: 'row',
  },
  projectTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  projectTagActive: {
    backgroundColor: colors.roles.ingenieur,
    borderColor: colors.roles.ingenieur,
  },
  projectTagText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: 'bold',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  tabButtonTextActive: {
    color: colors.roles.ingenieur,
  },
  scrollContainer: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  ganttCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  ganttHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ganttTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  ganttStatus: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  ganttDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  ganttBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  ganttBarFill: {
    height: '100%',
  },
  validateBtn: {
    backgroundColor: colors.roles.ingenieur,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  validateBtnText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 12,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  formHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  lotSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  lotTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: 6,
    marginBottom: 6,
  },
  lotTagActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  lotTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  subcontractorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  subTag: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  subTagActive: {
    backgroundColor: colors.roles.ingenieur,
    borderColor: colors.roles.ingenieur,
  },
  subTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
  },
  photoBtn: {
    borderWidth: 1,
    borderColor: colors.roles.ingenieur,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  photoBtnText: {
    color: colors.roles.ingenieur,
    fontWeight: 'bold',
    fontSize: 12,
  },
  submitBtn: {
    backgroundColor: colors.roles.ingenieur,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  snagCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  snagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  snagTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  snagDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  snagMeta: {
    fontSize: 11,
    color: colors.text,
    marginBottom: 4,
  },
  photoLink: {
    fontSize: 11,
    color: colors.roles.ingenieur,
    fontWeight: 'bold',
    marginTop: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginVertical: 20,
  },
});
