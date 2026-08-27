import React, { useState, useEffect, useContext } from "react";
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
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "../../context/AuthContext";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import Svg, { Circle, G, Path } from "react-native-svg";
import DateTimePicker from "@react-native-community/datetimepicker";

// Photo factice en Base64 représentative d'un constat de chantier (ex. plomberie défectueuse)
const MOCK_BASE64_PHOTO =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export default function EngineerDashboard({ navigation, route }) {
  const { user, logout } = useContext(AuthContext);

  // États de l'interface
  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks' (default), 'milestones' ou 'snags'
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Données
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState(null);
  const [taskTree, setTaskTree] = useState([]);
  const [engineers, setEngineers] = useState([]);

  const [milestones, setMilestones] = useState([]);
  const [snags, setSnags] = useState([]);
  const [lots, setLots] = useState([]);

  // États de saisie des réserves (Snags)
  const [selectedLotId, setSelectedLotId] = useState("");
  const [snagTitle, setSnagTitle] = useState("");
  const [snagDesc, setSnagDesc] = useState("");
  const [snagSeverity, setSnagSeverity] = useState("medium");
  const [subcontractor, setSubcontractor] = useState("plumber"); // plumber, electrician, painter
  const [attachedPhoto, setAttachedPhoto] = useState(null); // photo Base64

  // États CRUD des tâches
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [taskParentId, setTaskParentId] = useState(null);
  const [taskParentTitle, setTaskParentTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskTargetDate, setTaskTargetDate] = useState(new Date());
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskHasChildren, setEditingTaskHasChildren] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [collapsedMap, setCollapsedMap] = useState({});
  const toggleCollapse = (id) =>
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));

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
    if (!selectedProjectId) return;
    try {
      const cachedProjects = await AsyncStorage.getItem("cachedProjects");
      const cachedDetail = await AsyncStorage.getItem(
        `cachedProjectDetail_${selectedProjectId}`,
      );
      const cachedTree = await AsyncStorage.getItem(
        `cachedTaskTree_${selectedProjectId}`,
      );
      const cachedMilestones = await AsyncStorage.getItem(
        `cachedMilestones_${selectedProjectId}`,
      );
      const cachedSnags = await AsyncStorage.getItem("cachedSnags");
      const cachedLots = await AsyncStorage.getItem(
        `cachedLots_${selectedProjectId}`,
      );

      if (cachedProjects) setProjects(JSON.parse(cachedProjects));
      if (cachedDetail) setProjectDetail(JSON.parse(cachedDetail));
      if (cachedTree) setTaskTree(JSON.parse(cachedTree));
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
      const projRes = await api.getProjects();
      setProjects(projRes.projects || []);
      await AsyncStorage.setItem(
        "cachedProjects",
        JSON.stringify(projRes.projects),
      );

      let currentProjId = selectedProjectId;
      if (!currentProjId && projRes.projects && projRes.projects.length > 0) {
        currentProjId = projRes.projects[0].id;
        setSelectedProjectId(currentProjId);
      }

      if (currentProjId) {
        // Récupérer les détails complexes du projet (header, engineers, hierarchical tasks)
        try {
          const detailRes = await api.getProjectDetail(currentProjId);
          setProjectDetail(detailRes.project || null);
          setTaskTree(detailRes.taskTree || []);

          // Extraire tous les ingénieurs assignés pour pouvoir leur réaffecter des tâches
          if (detailRes.project && detailRes.project.assigned_engineers) {
            setEngineers(detailRes.project.assigned_engineers);
          }

          await AsyncStorage.setItem(
            `cachedProjectDetail_${currentProjId}`,
            JSON.stringify(detailRes.project),
          );
          await AsyncStorage.setItem(
            `cachedTaskTree_${currentProjId}`,
            JSON.stringify(detailRes.taskTree),
          );
        } catch (detailErr) {
          console.warn("Erreur getProjectDetail:", detailErr.message);
        }

        // Récupérer les jalons du chantier (pour la facturation)
        const milestoneRes = await api.getMilestones(currentProjId);
        setMilestones(milestoneRes.milestones || []);
        await AsyncStorage.setItem(
          `cachedMilestones_${currentProjId}`,
          JSON.stringify(milestoneRes.milestones),
        );

        // Récupérer les lots du projet pour pouvoir leur associer des réserves
        const lotsRes = await api.getLotsByProject(currentProjId);
        setLots(lotsRes.lots || []);
        await AsyncStorage.setItem(
          `cachedLots_${currentProjId}`,
          JSON.stringify(lotsRes.lots),
        );
        if (lotsRes.lots && lotsRes.lots.length > 0) {
          setSelectedLotId(lotsRes.lots[0].id);
        }
      }

      // Récupérer les réserves (SAV)
      const snagsRes = await api.getSnags();
      setSnags(snagsRes.snags || []);
      await AsyncStorage.setItem("cachedSnags", JSON.stringify(snagsRes.snags));

      setIsOnline(true);
    } catch (err) {
      console.log(
        "Mode hors-ligne détecté ou serveur injoignable. Consultation locale.",
      );
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // 3. GESTION DE LA FILE DE SYNCHRONISATION (OFFLINE QUEUE)
  const checkSyncQueue = async () => {
    try {
      const queue = JSON.parse(
        (await AsyncStorage.getItem("offlineSyncQueue")) || "[]",
      );
      setSyncQueueLength(queue.length);
    } catch (err) {
      console.error(err);
    }
  };

  // Enregistrer une action dans la queue de synchronisation si hors-ligne
  const enqueueOfflineAction = async (actionType, endpoint, payload) => {
    try {
      const queue = JSON.parse(
        (await AsyncStorage.getItem("offlineSyncQueue")) || "[]",
      );
      queue.push({
        id: Date.now().toString(),
        type: actionType,
        endpoint,
        payload,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem("offlineSyncQueue", JSON.stringify(queue));
      setSyncQueueLength(queue.length);

      Alert.alert(
        "Action sauvegardée localement",
        "Vous êtes hors-ligne. Les modifications ont été stockées sur votre appareil et seront envoyées automatiquement dès le retour de la connexion.",
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Synchroniser manuellement la file
  const handleSyncQueue = async () => {
    setActionLoading("sync");
    try {
      const queue = JSON.parse(
        (await AsyncStorage.getItem("offlineSyncQueue")) || "[]",
      );
      if (queue.length === 0) {
        Alert.alert("Info", "Aucune modification locale en attente.");
        setActionLoading(null);
        return;
      }

      let successCount = 0;
      for (const item of queue) {
        try {
          if (item.type === "validate_milestone") {
            await api.validateMilestone(item.payload.milestoneId);
          } else if (item.type === "create_snag") {
            await api.createSnag(item.payload);
          }
          successCount++;
        } catch (itemErr) {
          console.error(
            `Erreur de synchronisation pour l'action ${item.id}:`,
            itemErr.message,
          );
        }
      }

      const remainingQueue = queue.slice(successCount);
      await AsyncStorage.setItem(
        "offlineSyncQueue",
        JSON.stringify(remainingQueue),
      );
      setSyncQueueLength(remainingQueue.length);

      Alert.alert(
        "Synchronisation terminée",
        `${successCount} action(s) synchronisée(s) avec succès. ${remainingQueue.length} échec(s).`,
      );

      fetchOnlineData();
    } catch (err) {
      Alert.alert("Erreur", "Impossible de synchroniser pour le moment.");
    } finally {
      setActionLoading(null);
    }
  };

  // 4. ACTION : VALIDER UN JALON / ETAPE CHANTIER
  const handleValidateStep = async (milestoneId, title) => {
    Alert.alert(
      "Validation d'étape",
      `Confirmez-vous que l'étape "${title}" est achevée ? Cette action mettra à jour la timeline du client et générera les demandes de paiements correspondantes.`,
      [
        {
          text: "Valider",
          onPress: async () => {
            if (!isOnline) {
              setMilestones((prev) =>
                prev.map((m) =>
                  m.id === milestoneId
                    ? { ...m, is_validated: true, progress_percent: 100 }
                    : m,
                ),
              );
              await enqueueOfflineAction(
                "validate_milestone",
                `/milestones/${milestoneId}/validate`,
                { milestoneId },
              );
              return;
            }

            setActionLoading(milestoneId);
            try {
              const res = await api.validateMilestone(milestoneId);
              Alert.alert(
                "Succès",
                `Étape validée. ${res.paymentsGenerated} appel(s) de fonds émis.`,
              );
              fetchOnlineData();
            } catch (err) {
              Alert.alert("Erreur", err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
        { text: "Annuler", style: "cancel" },
      ],
    );
  };

  // 5. ACTION : CREER UNE RESERVE CHANTIER (SAV)
  const handleCreateSnag = async () => {
    if (!snagTitle) {
      Alert.alert("Erreur", "Veuillez saisir le titre de la réserve.");
      return;
    }

    const payload = {
      lot_id: selectedLotId,
      title: snagTitle,
      description: snagDesc,
      severity: snagSeverity,
      subcontractor,
      photoBase64: attachedPhoto,
    };

    if (!isOnline) {
      const mockNewSnag = {
        id: `offline_${Date.now()}`,
        lot_id: selectedLotId,
        title: snagTitle,
        description: snagDesc,
        severity: snagSeverity,
        status: "open",
        subcontractor,
        created_at: new Date().toISOString(),
      };
      setSnags((prev) => [mockNewSnag, ...prev]);
      await enqueueOfflineAction("create_snag", "/snags", payload);
      resetSnagForm();
      return;
    }

    setActionLoading("create_snag");
    try {
      await api.createSnag(payload);
      Alert.alert(
        "Réserve enregistrée",
        "La réserve de chantier a été envoyée et le sous-traitant affecté.",
      );
      resetSnagForm();
      fetchOnlineData();
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const resetSnagForm = () => {
    setSnagTitle("");
    setSnagDesc("");
    setAttachedPhoto(null);
  };

  // Simuler la capture de photo
  const handleCapturePhoto = () => {
    setAttachedPhoto(MOCK_BASE64_PHOTO);
    Alert.alert(
      "Photo capturée",
      "Image de chantier jointe avec succès (simulation caméra en base64).",
    );
  };

  // =========================================================================
  // ACTIONS DE GESTION DES TÂCHES HIERARCHIQUES
  // =========================================================================

  const openCreateTaskModal = (parentId = null, parentTitle = "") => {
    setTaskParentId(parentId);
    setTaskParentTitle(parentTitle);
    setTaskTitle("");
    setTaskDescription("");
    setTaskTargetDate(new Date());
    setTaskProgress(0);
    setTaskAssignedTo("");
    setIsCreateModalVisible(true);
  };

  const handleCreateHierarchicalTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert("Erreur", "Le titre de la tâche est obligatoire.");
      return;
    }

    setActionLoading("create_task");
    try {
      const payload = {
        title: taskTitle,
        description: taskDescription,
        target_date: taskTargetDate.toISOString(),
        progress_percentage: Number(taskProgress),
        parent_id: taskParentId,
        project_id: selectedProjectId,
        assigned_to: taskAssignedTo || null,
      };

      await api.createHierarchicalTask(payload);
      setIsCreateModalVisible(false);
      Alert.alert("Succès", "Tâche créée avec succès.");
      fetchOnlineData();
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const openEditTaskModal = (task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description || "");
    setTaskTargetDate(
      task.target_date ? new Date(task.target_date) : new Date(),
    );
    setTaskProgress(task.progress_percentage || 0);
    setTaskAssignedTo(task.assigned_to || "");

    // Déterminer si la tâche a des enfants pour désactiver l'édition de progrès
    const hasChildren = task.subtasks && task.subtasks.length > 0;
    setEditingTaskHasChildren(hasChildren);

    setIsEditModalVisible(true);
  };

  const handleUpdateHierarchicalTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert("Erreur", "Le titre est requis.");
      return;
    }

    setActionLoading("update_task");
    try {
      const payload = {
        title: taskTitle,
        description: taskDescription,
        target_date: taskTargetDate.toISOString(),
        progress_percentage: editingTaskHasChildren
          ? undefined
          : Number(taskProgress),
        assigned_to: taskAssignedTo || null,
      };

      await api.updateHierarchicalTask(editingTaskId, payload);
      setIsEditModalVisible(false);
      Alert.alert("Succès", "Tâche mise à jour avec succès.");
      fetchOnlineData();
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteHierarchicalTask = (taskId, title) => {
    Alert.alert(
      "Supprimer la tâche",
      `Êtes-vous sûr de vouloir supprimer "${title}" ? Toutes ses sous-tâches associées seront également supprimées définitivement.`,
      [
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setActionLoading("delete_task");
            try {
              await api.deleteHierarchicalTask(taskId);
              Alert.alert("Succès", "Tâche supprimée.");
              fetchOnlineData();
            } catch (err) {
              Alert.alert("Erreur", err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
        { text: "Annuler", style: "cancel" },
      ],
    );
  };

  // Composant récursif pour afficher les tâches et sous-tâches (jusqu'à 3 niveaux)
  const renderTaskNode = (task) => {
    const hasChildren = task.subtasks && task.subtasks.length > 0;
    const isCollapsed = collapsedMap[task.id] || false;
    const level = task.level || 1;

    // Définir les styles en fonction du niveau de hiérarchie
    let cardStyle = styles.taskCardL1;
    if (level === 2) cardStyle = styles.taskCardL2;
    if (level === 3) cardStyle = styles.taskCardL3;

    return (
      <View key={task.id} style={{ marginBottom: 2 }}>
        <View style={cardStyle}>
          <View style={styles.taskHeaderRow}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
              onPress={() => hasChildren && toggleCollapse(task.id)}
              activeOpacity={hasChildren ? 0.7 : 1}
            >
              {hasChildren && (
                <Text style={styles.collapseArrow}>
                  {isCollapsed ? "▶" : "▼"}
                </Text>
              )}
              <Text style={styles.taskNodeTitle}>{task.title}</Text>
            </TouchableOpacity>

            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>
                {Math.round(task.progress_percentage || 0)}%
              </Text>
            </View>
          </View>

          {task.description ? (
            <Text style={styles.taskNodeDesc}>{task.description}</Text>
          ) : null}

          {/* Méta-données de la tâche */}
          <View style={styles.taskMetaRow}>
            {task.target_date && (
              <Text style={styles.taskMetaText}>
                📅 {new Date(task.target_date).toLocaleDateString("fr-FR")}
              </Text>
            )}
            {task.assigned_profile && (
              <Text style={styles.taskMetaText}>
                👷{" "}
                {task.assigned_profile.full_name || task.assigned_profile.email}
              </Text>
            )}
          </View>

          {/* Barre de progrès de la tâche */}
          <View style={styles.taskProgressBarBg}>
            <View
              style={[
                styles.taskProgressBarFill,
                { width: `${task.progress_percentage || 0}%` },
              ]}
            />
          </View>

          {/* Barre d'actions (CRUD & Rôles) */}
          <View style={styles.taskNodeActions}>
            {level < 3 && (
              <TouchableOpacity
                onPress={() => openCreateTaskModal(task.id, task.title)}
              >
                <Text style={[styles.actionBtnText, styles.addBtnText]}>
                  + Sous-tâche
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => openEditTaskModal(task)}>
              <Text style={styles.actionBtnText}>Modifier ✏️</Text>
            </TouchableOpacity>
            {(user?.role === "promoteur" || user?.role === "admin") && (
              <TouchableOpacity
                onPress={() =>
                  handleDeleteHierarchicalTask(task.id, task.title)
                }
              >
                <Text style={[styles.actionBtnText, styles.deleteBtnText]}>
                  Supprimer 🗑️
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Affichage récursif des sous-tâches */}
        {hasChildren && !isCollapsed && (
          <View style={styles.treeChildrenContainer}>
            {task.subtasks.map((subtask) => renderTaskNode(subtask))}
          </View>
        )}
      </View>
    );
  };

  // Composant SVG pour le progrès global
  const renderGlobalProgressCircle = (percentage) => {
    const size = 95;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <View style={styles.circleContainer}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {/* Background Track */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#334155"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Stroke */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.roles.ingenieur}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </G>
        </Svg>
        <View style={styles.circleOverlay}>
          <Text style={styles.circlePercentageText}>
            {Math.round(percentage)}%
          </Text>
          <Text style={styles.circleLabelText}>GLOBAL</Text>
        </View>
      </View>
    );
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
            style={[
              styles.connectionBadge,
              isOnline ? styles.badgeOnline : styles.badgeOffline,
              { marginRight: 8 },
            ]}
            onPress={() => {
              setIsOnline(!isOnline);
              Alert.alert(
                "Statut Réseau",
                `Vous êtes passé en mode ${!isOnline ? "En ligne" : "Hors-ligne (Simulé)"}`,
              );
            }}
          >
            <Text style={styles.connectionText}>
              {isOnline ? "EN LIGNE 📶" : "HORS-LIGNE 🚫"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate("Profile")}
          >
            <Text style={styles.profileBtnText}>Profil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.profileBtn, { backgroundColor: "#e74c3c" }]}
            onPress={async () => {
              await logout();
            }}
          >
            <Text style={[styles.profileBtnText, { color: "#fff" }]}>
              Déconnexion
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync Banner */}
      {syncQueueLength > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            {syncQueueLength} action(s) en attente de synchronisation.
          </Text>
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleSyncQueue}
            disabled={actionLoading === "sync"}
          >
            {actionLoading === "sync" ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Synchroniser</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Project Selector */}
      <View style={styles.projectSelectorCard}>
        <Text style={styles.selectorLabel}>
          Chantier en cours de supervision :
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.projectList}
        >
          {projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.projectTag,
                selectedProjectId === p.id && styles.projectTagActive,
              ]}
              onPress={() => setSelectedProjectId(p.id)}
            >
              <Text
                style={[
                  styles.projectTagText,
                  selectedProjectId === p.id && { color: colors.background },
                ]}
              >
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "tasks" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("tasks")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "tasks" && styles.tabButtonTextActive,
            ]}
          >
            Suivi Chantier
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "milestones" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("milestones")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "milestones" && styles.tabButtonTextActive,
            ]}
          >
            Jalons Facture
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "snags" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("snags")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "snags" && styles.tabButtonTextActive,
            ]}
          >
            Réserves SAV
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {activeTab === "tasks" ? (
          /* TAB 0: ADVANCED CONSTRUCTION TASK TRACKING */
          <View>
            {loading ? (
              <ActivityIndicator
                color={colors.roles.ingenieur}
                style={{ marginVertical: 30 }}
              />
            ) : !projectDetail ? (
              <Text style={styles.emptyText}>
                Aucun détail de chantier disponible.
              </Text>
            ) : (
              <View>
                {/* Project Header Context Card */}
                <View style={styles.projectContextCard}>
                  <View style={styles.projectContextInfo}>
                    <Text style={styles.projectLabel}>PROSPECT IMMO</Text>
                    <Text style={styles.projectTitleText}>
                      {projectDetail.name}
                    </Text>

                    <Text style={styles.projectDetailText}>
                      <Text style={{ fontWeight: "bold", color: colors.text }}>
                        Promoteur :
                      </Text>{" "}
                      {projectDetail.promoter_name || "Non spécifié"}
                    </Text>
                    <Text style={styles.projectDetailText}>
                      <Text style={{ fontWeight: "bold", color: colors.text }}>
                        Constructeur :
                      </Text>{" "}
                      {projectDetail.constructor_name || "Non spécifié"}
                    </Text>
                    <Text style={styles.projectDetailText}>
                      <Text style={{ fontWeight: "bold", color: colors.text }}>
                        Livraison cible :
                      </Text>{" "}
                      {projectDetail.target_completion_date
                        ? new Date(
                            projectDetail.target_completion_date,
                          ).toLocaleDateString("fr-FR")
                        : "Non spécifié"}
                    </Text>
                    <Text style={styles.projectDetailText}>
                      <Text style={{ fontWeight: "bold", color: colors.text }}>
                        Ingénieurs affectés :
                      </Text>{" "}
                      {projectDetail.engineers_count || 0}
                    </Text>
                  </View>

                  {/* SVG circular progress */}
                  {renderGlobalProgressCircle(
                    projectDetail.global_progress || 0,
                  )}
                </View>

                {/* Horizontal progress bar details */}
                <View style={styles.globalProgressCard}>
                  <Text style={styles.globalProgressLabel}>
                    Progression globale du gros œuvre
                  </Text>
                  <View style={styles.globalProgressBarBg}>
                    <View
                      style={[
                        styles.globalProgressBarFill,
                        { width: `${projectDetail.global_progress || 0}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Add Root Level 1 Task button (Promoter and Admin only) */}
                {(user?.role === "promoteur" || user?.role === "admin") && (
                  <TouchableOpacity
                    style={styles.addRootTaskBtn}
                    onPress={() => openCreateTaskModal(null)}
                  >
                    <Text style={styles.addRootTaskBtnText}>
                      + Ajouter une tâche principale
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Recursive Task Tree */}
                <Text style={[styles.sectionHeader, { marginTop: 15 }]}>
                  Arborescence des Tâches
                </Text>
                {taskTree.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Aucune tâche n'a été créée pour ce chantier.
                  </Text>
                ) : (
                  taskTree.map((task) => renderTaskNode(task))
                )}
              </View>
            )}
          </View>
        ) : activeTab === "milestones" ? (
          /* TAB 1: GANTT / MILESTONES */
          <View>
            <Text style={styles.sectionHeader}>
              Étapes de construction du projet
            </Text>
            {loading ? (
              <ActivityIndicator
                color={colors.roles.ingenieur}
                style={{ marginVertical: 20 }}
              />
            ) : milestones.length === 0 ? (
              <Text style={styles.emptyText}>
                Aucune étape définie sur ce projet.
              </Text>
            ) : (
              milestones.map((item) => {
                const isUpdating = actionLoading === item.id;
                return (
                  <View key={item.id} style={styles.ganttCard}>
                    <View style={styles.ganttHeader}>
                      <Text style={styles.ganttTitle}>{item.title}</Text>
                      <Text
                        style={[
                          styles.ganttStatus,
                          item.is_validated
                            ? { color: colors.success }
                            : { color: colors.textMuted },
                        ]}
                      >
                        {item.is_validated ? "VALIDÉ ✓" : "À FAIRE"}
                      </Text>
                    </View>
                    <Text style={styles.ganttDesc}>{item.description}</Text>

                    <View style={styles.ganttBarBg}>
                      <View
                        style={[
                          styles.ganttBarFill,
                          {
                            width: `${item.progress_percent}%`,
                            backgroundColor: item.is_validated
                              ? colors.success
                              : colors.roles.ingenieur,
                          },
                        ]}
                      />
                    </View>

                    {!item.is_validated && (
                      <TouchableOpacity
                        style={styles.validateBtn}
                        onPress={() => handleValidateStep(item.id, item.title)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <ActivityIndicator
                            color={colors.background}
                            size="small"
                          />
                        ) : (
                          <Text style={styles.validateBtnText}>
                            Achever & Lancer Appel de fonds
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* TAB 2: SNAG LIST (SAV) & CREATION */
          <View>
            <View style={styles.formCard}>
              <Text style={styles.formHeader}>Signaler une réserve (SAV)</Text>

              <Text style={styles.inputLabel}>Lot affecté :</Text>
              <View style={styles.lotSelectorContainer}>
                {lots.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={[
                      styles.lotTag,
                      selectedLotId === l.id && styles.lotTagActive,
                    ]}
                    onPress={() => setSelectedLotId(l.id)}
                  >
                    <Text
                      style={[
                        styles.lotTagText,
                        selectedLotId === l.id && { color: colors.background },
                      ]}
                    >
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

              <Text style={styles.inputLabel}>
                Corps d'état / Sous-traitant :
              </Text>
              <View style={styles.subcontractorRow}>
                {["plumber", "electrician", "painter"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.subTag,
                      subcontractor === type && styles.subTagActive,
                    ]}
                    onPress={() => setSubcontractor(type)}
                  >
                    <Text
                      style={[
                        styles.subTagText,
                        subcontractor === type && { color: colors.background },
                      ]}
                    >
                      {type === "plumber"
                        ? "Plomberie"
                        : type === "electrician"
                          ? "Électricité"
                          : "Peinture"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.photoBtn}
                onPress={handleCapturePhoto}
              >
                <Text style={styles.photoBtnText}>
                  {attachedPhoto
                    ? "📸 Photo chantier jointe (1)"
                    : "📷 Prendre une photo de chantier"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateSnag}
                disabled={actionLoading === "create_snag"}
              >
                {actionLoading === "create_snag" ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    Enregistrer la réserve
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>Réserves et SAV actifs</Text>
            {snags.length === 0 ? (
              <Text style={styles.emptyText}>Aucune réserve enregistrée.</Text>
            ) : (
              snags.map((item) => (
                <View key={item.id} style={styles.snagCard}>
                  <View style={styles.snagHeader}>
                    <Text style={styles.snagTitle}>{item.title}</Text>
                    <View
                      style={[
                        styles.severityBadge,
                        {
                          borderColor:
                            item.severity === "high"
                              ? colors.danger
                              : colors.warning,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          {
                            color:
                              item.severity === "high"
                                ? colors.danger
                                : colors.warning,
                          },
                        ]}
                      >
                        {item.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.snagDesc}>{item.description}</Text>
                  <Text style={styles.snagMeta}>
                    Affecté :{" "}
                    {item.subcontractor === "plumber"
                      ? "Plomberie"
                      : item.subcontractor === "electrician"
                        ? "Électricité"
                        : "Peinture"}
                  </Text>
                  <Text style={styles.snagMeta}>
                    Statut : {item.status.toUpperCase()}
                  </Text>

                  {item.photo_url && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.photo_url)}
                    >
                      <Text style={styles.photoLink}>
                        🖼️ Voir la photo de chantier
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* =========================================================================
          MODAL: CREER UNE TACHE / SOUS-TACHE
          ========================================================================= */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>
              {taskParentId
                ? `Ajouter une sous-tâche`
                : `Créer une tâche principale`}
            </Text>
            {taskParentTitle ? (
              <Text style={styles.modalSubHeader}>
                Sous-tâche de : {taskParentTitle}
              </Text>
            ) : null}

            <ScrollView style={{ maxHeight: 350 }}>
              <Text style={styles.modalInputLabel}>Titre de la tâche * :</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Pose de la tuyauterie"
                placeholderTextColor={colors.textMuted}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />

              <Text style={styles.modalInputLabel}>Description :</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 60, textAlignVertical: "top" },
                ]}
                placeholder="Ex: Raccordement des tuyaux cuivre..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                value={taskDescription}
                onChangeText={setTaskDescription}
              />

              <Text style={styles.modalInputLabel}>
                Progrès initial (0-100%) :
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={taskProgress.toString()}
                onChangeText={(val) => setTaskProgress(Number(val) || 0)}
              />

              <Text style={styles.modalInputLabel}>Ingénieur assigné :</Text>
              <View style={styles.assigneeContainer}>
                <TouchableOpacity
                  style={[
                    styles.assigneeTag,
                    taskAssignedTo === "" && styles.assigneeTagActive,
                  ]}
                  onPress={() => setTaskAssignedTo("")}
                >
                  <Text
                    style={[
                      styles.assigneeTagText,
                      taskAssignedTo === "" && { color: colors.background },
                    ]}
                  >
                    Aucun
                  </Text>
                </TouchableOpacity>
                {engineers.map((eng) => (
                  <TouchableOpacity
                    key={eng.id}
                    style={[
                      styles.assigneeTag,
                      taskAssignedTo === eng.id && styles.assigneeTagActive,
                    ]}
                    onPress={() => setTaskAssignedTo(eng.id)}
                  >
                    <Text
                      style={[
                        styles.assigneeTagText,
                        taskAssignedTo === eng.id && {
                          color: colors.background,
                        },
                      ]}
                    >
                      {eng.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalInputLabel}>
                Date cible de réalisation :
              </Text>
              <TouchableOpacity
                style={styles.dateSelectorBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateSelectorText}>
                  📅 Limite : {taskTargetDate.toLocaleDateString("fr-FR")}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={taskTargetDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTaskTargetDate(selectedDate);
                    }
                  }}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setIsCreateModalVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleCreateHierarchicalTask}
                disabled={actionLoading === "create_task"}
              >
                {actionLoading === "create_task" ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.modalBtnTextConfirm}>Créer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL: MODIFIER UNE TACHE
          ========================================================================= */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>Modifier la tâche</Text>

            <ScrollView style={{ maxHeight: 350 }}>
              <Text style={styles.modalInputLabel}>Titre de la tâche :</Text>
              <TextInput
                style={styles.modalInput}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />

              <Text style={styles.modalInputLabel}>Description :</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 60, textAlignVertical: "top" },
                ]}
                multiline
                numberOfLines={2}
                value={taskDescription}
                onChangeText={setTaskDescription}
              />

              {editingTaskHasChildren ? (
                <View style={styles.calculatedProgressAlert}>
                  <Text style={styles.calculatedProgressAlertText}>
                    💡 Cette tâche contient des sous-tâches. Son progrès est
                    automatiquement calculé comme la moyenne de ses sous-tâches.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.modalInputLabel}>
                    Progrès ({taskProgress}%) :
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: 50"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={taskProgress.toString()}
                    onChangeText={(val) => {
                      const num = Number(val);
                      setTaskProgress(
                        num >= 0 && num <= 100 ? num : taskProgress,
                      );
                    }}
                  />
                </View>
              )}

              <Text style={styles.modalInputLabel}>Ingénieur assigné :</Text>
              <View style={styles.assigneeContainer}>
                <TouchableOpacity
                  style={[
                    styles.assigneeTag,
                    taskAssignedTo === "" && styles.assigneeTagActive,
                  ]}
                  onPress={() => setTaskAssignedTo("")}
                >
                  <Text
                    style={[
                      styles.assigneeTagText,
                      taskAssignedTo === "" && { color: colors.background },
                    ]}
                  >
                    Aucun
                  </Text>
                </TouchableOpacity>
                {engineers.map((eng) => (
                  <TouchableOpacity
                    key={eng.id}
                    style={[
                      styles.assigneeTag,
                      taskAssignedTo === eng.id && styles.assigneeTagActive,
                    ]}
                    onPress={() => setTaskAssignedTo(eng.id)}
                  >
                    <Text
                      style={[
                        styles.assigneeTagText,
                        taskAssignedTo === eng.id && {
                          color: colors.background,
                        },
                      ]}
                    >
                      {eng.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalInputLabel}>
                Date cible de réalisation :
              </Text>
              <TouchableOpacity
                style={styles.dateSelectorBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateSelectorText}>
                  📅 Cible : {taskTargetDate.toLocaleDateString("fr-FR")}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={taskTargetDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTaskTargetDate(selectedDate);
                    }
                  }}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleUpdateHierarchicalTask}
                disabled={actionLoading === "update_task"}
              >
                {actionLoading === "update_task" ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.modalBtnTextConfirm}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "bold",
  },
  welcome: {
    fontSize: 20,
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: colors.text,
  },
  badgeOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgeOffline: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.roles.promoteur,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  syncBannerText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "bold",
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
    fontWeight: "bold",
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
    fontWeight: "bold",
    marginBottom: 8,
  },
  projectList: {
    flexDirection: "row",
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
    fontWeight: "bold",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
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
    fontWeight: "bold",
  },
  tabButtonTextActive: {
    color: colors.roles.ingenieur,
  },
  scrollContainer: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  ganttTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.text,
  },
  ganttStatus: {
    fontSize: 11,
    fontWeight: "bold",
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
    overflow: "hidden",
    marginBottom: 14,
  },
  ganttBarFill: {
    height: "100%",
  },
  validateBtn: {
    backgroundColor: colors.roles.ingenieur,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  validateBtnText: {
    color: colors.background,
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  lotSelectorContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontWeight: "bold",
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
    textAlignVertical: "top",
  },
  subcontractorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  subTag: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 8,
    alignItems: "center",
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
    fontWeight: "bold",
    color: colors.text,
  },
  photoBtn: {
    borderWidth: 1,
    borderColor: colors.roles.ingenieur,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "rgba(6, 182, 212, 0.05)",
  },
  photoBtnText: {
    color: colors.roles.ingenieur,
    fontWeight: "bold",
    fontSize: 12,
  },
  submitBtn: {
    backgroundColor: colors.roles.ingenieur,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitBtnText: {
    color: colors.background,
    fontWeight: "bold",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  snagTitle: {
    fontSize: 15,
    fontWeight: "bold",
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
    fontWeight: "bold",
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
    fontWeight: "bold",
    marginTop: 6,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    marginVertical: 20,
  },
  // =========================================================================
  // NOUVEAUX STYLES : GESTION DES TÂCHES HIERARCHIQUES
  // =========================================================================
  projectContextCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  projectContextInfo: {
    flex: 1,
    marginRight: 10,
  },
  projectLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.roles.ingenieur,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  projectTitleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  projectDetailText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  circleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  circleOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  circlePercentageText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
  },
  circleLabelText: {
    fontSize: 7,
    color: colors.textMuted,
    fontWeight: "bold",
    letterSpacing: 1,
    marginTop: -2,
  },
  globalProgressCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  globalProgressLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.textMuted,
    marginBottom: 8,
  },
  globalProgressBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: "hidden",
  },
  globalProgressBarFill: {
    height: "100%",
    backgroundColor: colors.roles.ingenieur,
    borderRadius: 4,
  },
  addRootTaskBtn: {
    backgroundColor: "rgba(6, 182, 212, 0.1)",
    borderWidth: 1,
    borderColor: colors.roles.ingenieur,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  addRootTaskBtnText: {
    color: colors.roles.ingenieur,
    fontWeight: "bold",
    fontSize: 13,
  },
  taskCardL1: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderLeftColor: colors.roles.ingenieur, // Cyan
    marginBottom: 8,
  },
  taskCardL2: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.roles.promoteur, // Gold
    marginBottom: 6,
  },
  taskCardL3: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.4)",
    borderLeftWidth: 3,
    borderLeftColor: colors.roles.client, // Violet
    marginBottom: 4,
  },
  taskHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  collapseArrow: {
    color: colors.textMuted,
    fontSize: 11,
    marginRight: 6,
    fontWeight: "bold",
  },
  taskNodeTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.text,
    flex: 1,
  },
  progressBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.text,
  },
  taskNodeDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 8,
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  taskMetaText: {
    fontSize: 10,
    color: colors.textMuted,
    marginRight: 12,
    marginBottom: 2,
  },
  taskProgressBarBg: {
    height: 4,
    backgroundColor: colors.background,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  taskProgressBarFill: {
    height: "100%",
    backgroundColor: colors.success,
  },
  taskNodeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "rgba(51, 65, 85, 0.3)",
    paddingTop: 8,
    marginTop: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.roles.ingenieur,
    marginLeft: 14,
  },
  addBtnText: {
    color: colors.success,
  },
  deleteBtnText: {
    color: colors.danger,
  },
  treeChildrenContainer: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    marginLeft: 10,
    paddingLeft: 8,
    marginTop: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  modalHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 2,
    textAlign: "center",
  },
  modalSubHeader: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
    textAlign: "center",
  },
  modalInputLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textMuted,
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  modalInput: {
    backgroundColor: colors.background,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 6,
  },
  dateSelectorBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  dateSelectorText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "bold",
  },
  assigneeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  assigneeTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: 6,
    marginBottom: 6,
  },
  assigneeTagActive: {
    backgroundColor: colors.roles.ingenieur,
    borderColor: colors.roles.ingenieur,
  },
  assigneeTagText: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.text,
  },
  calculatedProgressAlert: {
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  calculatedProgressAlertText: {
    color: colors.roles.ingenieur,
    fontSize: 11,
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  modalBtnConfirm: {
    backgroundColor: colors.roles.ingenieur,
    marginLeft: 8,
  },
  modalBtnTextCancel: {
    color: colors.text,
    fontWeight: "bold",
    fontSize: 13,
  },
  modalBtnTextConfirm: {
    color: colors.background,
    fontWeight: "bold",
    fontSize: 13,
  },
});
