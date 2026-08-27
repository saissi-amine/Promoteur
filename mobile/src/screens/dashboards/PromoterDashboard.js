import { colors } from "../../theme/colors";
import React, { useState, useEffect, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { AuthContext } from "../../context/AuthContext";
import { api } from "../../services/api";

// Utilisateurs fictifs pour le sélecteur d'affectation
const MOCK_PROFILES = [
  {
    id: "eng1",
    full_name: "Jean Dupont",
    email: "jean.dupont@chantier.com",
    role: "ingenieur",
  },
  {
    id: "eng2",
    full_name: "Michel Tremblay",
    email: "michel.t@chantier.com",
    role: "ingenieur",
  },
  {
    id: "comm1",
    full_name: "Amine Bennani",
    email: "amine.bennani@immo.ma",
    role: "commercial",
  },
  {
    id: "comm2",
    full_name: "Houda Lahlou",
    email: "houda.l@immo.ma",
    role: "commercial",
  },
];

export default function PromoterDashboard({ navigation, route }) {
  const { user, logout } = useContext(AuthContext);

  // États de l'interface
  const [activeTab, setActiveTab] = useState("macro"); // 'macro', 'rbac', 'tasks'
  const [loading, setLoading] = useState(true);

  // Données de l'API
  const [engineers, setEngineers] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [projectsSummary, setProjectsSummary] = useState([]);
  const [projects, setProjects] = useState([]);

  // États d'affectation de projet (RBAC)
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(
    MOCK_PROFILES[0].id,
  );
  const [assigning, setAssigning] = useState(false);

  // États du formulaire de création de tâche (conservé et amélioré)
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPromoterDashboardData();
  }, []);

  const fetchPromoterDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les données de trésorerie & macro du backend
      const treasuryRes = await api.getPromoterTreasury();
      setTreasury(treasuryRes.treasury);
      setForecast(treasuryRes.cashFlowForecast || []);
      setProjectsSummary(treasuryRes.projectsSummary || []);

      // 2. Récupérer les projets
      const projRes = await api.getProjects();
      setProjects(projRes.projects || []);
      if (projRes.projects && projRes.projects.length > 0) {
        setSelectedProjectId(projRes.projects[0].id);
      }

      // 3. Récupérer les ingénieurs (pour l'assignation de tâche)
      const pageRes = await api.getPromoteurPage();
      setEngineers(pageRes.engineers || []);
      if (pageRes.engineers && pageRes.engineers.length > 0) {
        setSelectedEngineerId(pageRes.engineers[0].id);
      }
    } catch (err) {
      console.error(
        "Erreur de récupération des données promoteur:",
        err.message,
      );
      Alert.alert(
        "Erreur",
        "Impossible de connecter le tableau de bord de trésorerie.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Action : Relancer un client pour retard de paiement (Dunning)
  const handleDunningReminder = (payment) => {
    Alert.alert(
      "Relance Client",
      `Confirmez-vous l'envoi d'une notification de relance urgente à ${payment.client?.full_name || payment.client?.email} ?\n\nMontant en retard : ${Number(payment.amount).toLocaleString()} DH`,
      [
        {
          text: "Envoyer la relance",
          onPress: () => {
            Alert.alert(
              "Relance envoyée",
              "Un email de mise en demeure et un SMS de rappel ont été transmis au client.",
            );
          },
        },
        { text: "Annuler", style: "cancel" },
      ],
    );
  };

  // Action : Assigner un collaborateur à un projet (RBAC)
  const handleAssignProject = async () => {
    if (!selectedProjectId || !selectedProfileId) {
      Alert.alert(
        "Erreur",
        "Veuillez sélectionner un projet et un collaborateur.",
      );
      return;
    }

    setAssigning(true);
    try {
      const selectedProfile = MOCK_PROFILES.find(
        (p) => p.id === selectedProfileId,
      );

      await api.assignProject(
        selectedProjectId,
        selectedProfileId,
        selectedProfile ? selectedProfile.role : "ingenieur",
      );

      Alert.alert(
        "Succès",
        "Le collaborateur a été affecté à ce projet immobilier.",
      );
    } catch (err) {
      Alert.alert(
        "Erreur affectation",
        err.message || "Déjà affecté à ce projet.",
      );
    } finally {
      setAssigning(false);
    }
  };

  // Action : Assigner une tâche à un ingénieur
  const handleCreateTask = async () => {
    if (!taskTitle) {
      Alert.alert("Erreur", "Le titre de la tâche est obligatoire.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createTask({
        title: taskTitle,
        description: taskDesc,
        assigned_to: selectedEngineerId || null,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      Alert.alert("Succès", "La tâche chantier a été créée et affectée.");
      setTaskTitle("");
      setTaskDesc("");
    } catch (error) {
      Alert.alert("Erreur", error.message || "Impossible de créer la tâche.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.roles.promoteur} />
        <Text style={styles.loadingText}>
          Chargement du tableau de bord macro...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Macro Dashboard</Text>
          <Text style={styles.roleTitle}>
            Promoteur : {user?.fullName || user?.email}
          </Text>
        </View>

        {route?.name === "Home" && (
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate("Profile")}
          >
            <Text style={styles.profileBtnText}>Profil</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.profileBtn,
            { backgroundColor: colors.error || "#e74c3c" },
          ]}
          onPress={async () => {
            await logout();
          }}
        >
          <Text style={[styles.profileBtnText, { color: "#fff" }]}>
            Déconnexion
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "macro" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("macro")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "macro" && styles.tabButtonTextActive,
            ]}
          >
            Trésorerie & Ventes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "rbac" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("rbac")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "rbac" && styles.tabButtonTextActive,
            ]}
          >
            RBAC Affectations
          </Text>
        </TouchableOpacity>
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
            Assigner Tâche
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {activeTab === "macro" ? (
          /* TAB 1: MACRO DASHBOARD & TREASURY */
          <View>
            {/* STATS GENERALES */}
            <Text style={styles.sectionHeader}>
              Situation Financière Globale
            </Text>
            {treasury && (
              <View style={styles.treasuryMetricsRow}>
                <View style={styles.treasuryCard}>
                  <Text style={styles.metricVal}>
                    {Number(treasury.totalCollected).toLocaleString()} DH
                  </Text>
                  <Text style={styles.metricLabel}>Encaissé (Paid)</Text>
                  <View
                    style={[
                      styles.miniBar,
                      { backgroundColor: colors.success, width: "70%" },
                    ]}
                  />
                </View>
                <View style={styles.treasuryCard}>
                  <Text style={[styles.metricVal, { color: colors.danger }]}>
                    {Number(treasury.totalOverdue).toLocaleString()} DH
                  </Text>
                  <Text style={styles.metricLabel}>Retards (Overdue)</Text>
                  <View
                    style={[
                      styles.miniBar,
                      { backgroundColor: colors.danger, width: "25%" },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* PREVISIONS CASH-FLOW */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeader}>
                📈 Prévisions Cash-Flow (6 mois)
              </Text>
              <Text style={styles.cardDescription}>
                Projections de recouvrement basées sur les échéances d'appels de
                fonds chantiers.
              </Text>

              {forecast.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aucune prévision de trésorerie disponible.
                </Text>
              ) : (
                forecast.map((f, idx) => (
                  <View key={idx} style={styles.forecastRow}>
                    <Text style={styles.forecastMonth}>{f.month}</Text>
                    <View style={styles.forecastBarBg}>
                      <View
                        style={[
                          styles.forecastBarFill,
                          {
                            width: `${Math.min((f.amount / 1000000) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.forecastVal}>
                      {Number(f.amount).toLocaleString()} DH
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* CARTE / SYNTHESE PROJETS */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeader}>
                🗺️ Vue d'ensemble des Chantiers
              </Text>
              {/* Carte GPS simulée */}
              <View style={styles.mapMock}>
                <Text style={styles.mapMockText}>
                  🗺️ Carte Active des Projets
                </Text>
                <Text style={styles.mapMockCoord}>
                  Axe Casa (33.57) | Axe Rabat (34.02)
                </Text>
              </View>

              {projectsSummary.map((pSummary) => (
                <View key={pSummary.projectId} style={styles.projectSummaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectSummaryName}>
                      {pSummary.projectName}
                    </Text>
                    <Text style={styles.projectSummaryDetails}>
                      Lots : {pSummary.soldLots} vendus |{" "}
                      {pSummary.reservedLots} réservés |{" "}
                      {pSummary.availableLots} disponibles
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.projectSummaryVal}>
                      {Number(pSummary.salesRevenue).toLocaleString()} DH
                    </Text>
                    <Text style={styles.projectSummaryLbl}>
                      Chiffre d'Affaires
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* OVERDUE TRACKER (IMPAYES CLIENTS) */}
            <View style={styles.sectionCard}>
              <Text style={[styles.cardHeader, { color: colors.danger }]}>
                ⚠️ Overdue Tracker (Retards de Paiement)
              </Text>
              <Text style={styles.cardDescription}>
                Paiements en retard. Cliquez pour relancer l'acquéreur.
              </Text>

              {!treasury || treasury.overdueTracker.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aucun retard de paiement signalé. Trésorerie saine.
                </Text>
              ) : (
                treasury.overdueTracker.map((payment) => (
                  <View key={payment.id} style={styles.overdueItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.overdueClient}>
                        {payment.client?.full_name || payment.client?.email}
                      </Text>
                      <Text style={styles.overdueLot}>
                        Lot {payment.lot?.number} | {payment.lot?.project?.name}
                      </Text>
                      <Text style={styles.overdueMeta}>
                        Échéance dépassée le{" "}
                        {new Date(payment.due_date).toLocaleDateString("fr-FR")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.overdueAmount}>
                        {Number(payment.amount).toLocaleString()} DH
                      </Text>
                      <TouchableOpacity
                        style={styles.dunningBtn}
                        onPress={() => handleDunningReminder(payment)}
                      >
                        <Text style={styles.dunningBtnText}>Relancer ✉️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : activeTab === "rbac" ? (
          /* TAB 2: RBAC USER & PROJECT ASSIGNMENTS */
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeader}>
              🔑 Affectation et Rôles (RBAC)
            </Text>
            <Text style={styles.cardDescription}>
              Attribuez des commerciaux ou ingénieurs de chantiers à des projets
              immobiliers spécifiques.
            </Text>

            <View style={styles.form}>
              <Text style={styles.formLabel}>1. Sélectionner le Projet :</Text>
              <View style={styles.listSelectorContainer}>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.projectRBACItem,
                      selectedProjectId === p.id &&
                        styles.projectRBACItemActive,
                    ]}
                    onPress={() => setSelectedProjectId(p.id)}
                  >
                    <Text
                      style={[
                        styles.projectRBACText,
                        selectedProjectId === p.id && {
                          color: colors.background,
                        },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>
                2. Sélectionner le Collaborateur :
              </Text>
              <View style={styles.listSelectorContainer}>
                {MOCK_PROFILES.map((prof) => (
                  <TouchableOpacity
                    key={prof.id}
                    style={[
                      styles.projectRBACItem,
                      selectedProfileId === prof.id &&
                        styles.projectRBACItemActive,
                    ]}
                    onPress={() => setSelectedProfileId(prof.id)}
                  >
                    <Text
                      style={[
                        styles.projectRBACText,
                        selectedProfileId === prof.id && {
                          color: colors.background,
                        },
                      ]}
                    >
                      {prof.full_name} (
                      {prof.role === "ingenieur" ? "Ingénieur" : "Commercial"})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAssignProject}
                disabled={assigning}
              >
                {assigning ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    Assigner au Projet chantiers
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* TAB 3: ASSIGN TECHNICAL TASK (From V1) */
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeader}>
              🛠️ Créer une tâche technique de chantier
            </Text>
            <Text style={styles.cardDescription}>
              Émettez des directives chantiers aux ingénieurs.
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Nom de la tâche chantier..."
                placeholderTextColor={colors.textMuted}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description des travaux et consignes..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={taskDesc}
                onChangeText={setTaskDesc}
              />

              <Text style={styles.formLabel}>
                Assigner à l'Ingénieur en charge :
              </Text>
              <View style={styles.listSelectorContainer}>
                {engineers.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Aucun ingénieur affecté sur l'API.
                  </Text>
                ) : (
                  engineers.map((eng) => (
                    <TouchableOpacity
                      key={eng.id}
                      style={[
                        styles.projectRBACItem,
                        selectedEngineerId === eng.id &&
                          styles.projectRBACItemActive,
                      ]}
                      onPress={() => setSelectedEngineerId(eng.id)}
                    >
                      <Text
                        style={[
                          styles.projectRBACText,
                          selectedEngineerId === eng.id && {
                            color: colors.background,
                          },
                        ]}
                      >
                        {eng.full_name || eng.email}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateTask}
                disabled={submitting || engineers.length === 0}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    Créer et Assigner la tâche
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
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
  welcome: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.roles.promoteur,
  },
  roleTitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  profileBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileBtnText: {
    color: colors.text,
    fontWeight: "bold",
    fontSize: 13,
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
    color: colors.roles.promoteur,
  },
  scrollContainer: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  treasuryMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  treasuryCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  miniBar: {
    height: 4,
    borderRadius: 2,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 14,
  },
  forecastRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  forecastMonth: {
    width: 60,
    fontSize: 12,
    color: colors.text,
    fontWeight: "500",
  },
  forecastBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  forecastBarFill: {
    height: "100%",
    backgroundColor: colors.roles.promoteur,
  },
  forecastVal: {
    width: 80,
    fontSize: 11,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "right",
  },
  mapMock: {
    height: 100,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  mapMockText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
  },
  mapMockCoord: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  projectSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projectSummaryName: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.text,
  },
  projectSummaryDetails: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  projectSummaryVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.success,
  },
  projectSummaryLbl: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  overdueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  overdueClient: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.text,
  },
  overdueLot: {
    fontSize: 12,
    color: colors.roles.promoteur,
    marginTop: 1,
  },
  overdueMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
  },
  overdueAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.danger,
    marginBottom: 6,
  },
  dunningBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dunningBtnText: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: "bold",
  },
  form: {
    marginTop: 6,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  listSelectorContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  projectRBACItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: 6,
    marginBottom: 6,
  },
  projectRBACItemActive: {
    backgroundColor: colors.roles.promoteur,
    borderColor: colors.roles.promoteur,
  },
  projectRBACText: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.text,
  },
  submitBtn: {
    backgroundColor: colors.roles.promoteur,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: colors.background,
    fontWeight: "bold",
    fontSize: 14,
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
  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    marginVertical: 20,
  },
});
