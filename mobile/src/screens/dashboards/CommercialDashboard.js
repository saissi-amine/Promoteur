import { colors } from "../../theme/colors";
import React, { useState, useEffect, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { AuthContext } from "../../context/AuthContext";
import { api } from "../../services/api";

// Données CRM statiques pour simuler le mini-CRM
const MOCK_LEADS = [
  {
    id: "lead1",
    name: "Karim Alami",
    email: "karim.alami@gmail.com",
    phone: "+212 661 123 456",
    status: "Chaud",
    lastContact: "02/08/2026 : Rappel pour signature",
    projectOfInterest: "Résidence ATLAS",
  },
  {
    id: "lead2",
    name: "Sara Bennani",
    email: "sara.bennani@hotmail.com",
    phone: "+212 662 987 654",
    status: "Nouveau",
    lastContact: "01/08/2026 : Intéressée par Villa Océan",
    projectOfInterest: "Villa Océan",
  },
  {
    id: "lead3",
    name: "Youssef Filali",
    email: "youssef.filali@yahoo.fr",
    phone: "+212 663 456 789",
    status: "Tiède",
    lastContact: "28/07/2026 : A visité le témoin",
    projectOfInterest: "Résidence ATLAS",
  },
];

export default function CommercialDashboard({ navigation, route }) {
  const { user, logout } = useContext(AuthContext);
  const [menuVisible, setMenuVisible] = useState(false);

  // États de l'application
  const [activeTab, setActiveTab] = useState("lots"); // 'lots' ou 'crm'
  const [loading, setLoading] = useState(true);
  const [lots, setLots] = useState([]);
  const [filteredLots, setFilteredLots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'available', 'reserved', 'sold'
  const [commissionInfo, setCommissionInfo] = useState({
    totalSales: 0,
    estimatedComm: 0,
  });
  const [leads, setLeads] = useState(MOCK_LEADS);
  const [actionLoading, setActionLoading] = useState(null); // id du lot en cours d'action

  useEffect(() => {
    fetchCommercialData();
  }, []);

  const fetchCommercialData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les projets
      const projRes = await api.getProjects();
      setProjects(projRes.projects || []);

      // 2. Récupérer tous les lots chantiers
      const lotsRes = await api.getAllLots();
      const allLots = lotsRes.lots || [];
      setLots(allLots);
      setFilteredLots(allLots);

      // 3. Calculer la jauge de commission (2% sur les lots réservés/vendus par ce commercial)
      calculateCommissions(allLots);
    } catch (err) {
      console.error(
        "Erreur de récupération des données commercial:",
        err.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateCommissions = (allLots) => {
    // Filtrer les lots vendus ou réservés par le commercial actuel (ou tous si admin/promoteur)
    const myLots = allLots.filter(
      (l) =>
        (l.status === "sold" || l.status === "reserved") &&
        (l.commercial_id === user.id ||
          user.role === "admin" ||
          user.role === "promoteur"),
    );

    const totalSales = myLots.reduce(
      (acc, curr) => acc + Number(curr.price),
      0,
    );
    const estimatedComm = totalSales * 0.02; // Commission fixe à 2%
    setCommissionInfo({ totalSales, estimatedComm });
  };

  // Filtrer les lots dynamiquement
  useEffect(() => {
    let result = lots;

    if (selectedProjectId !== "all") {
      result = result.filter((l) => l.project_id === selectedProjectId);
    }

    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }

    setFilteredLots(result);
  }, [selectedProjectId, statusFilter, lots]);

  // Action : Générer le contrat de réservation de lot via l'Express API
  const handleGenerateContract = (lot) => {
    // Simuler le choix d'un client du CRM pour ce contrat
    const clientOptions = leads.map((l) => ({
      text: l.name,
      onPress: () =>
        processContractGeneration(
          lot.id,
          "3da5b6fa-9011-4770-983b-f458e0a1c1d0" || user.id,
          lot.number,
        ), // Utilise un ID client simulé ou celui du conseiller
    }));

    Alert.alert(
      "Générer un contrat",
      `Sélectionnez le client acquéreur pour le Lot N° ${lot.number} :`,
      [
        ...clientOptions.map((opt) => ({
          text: opt.text,
          onPress: () =>
            processContractGeneration(
              lot.id,
              "3da5b6fa-9011-4770-983b-f458e0a1c1d0",
              lot.number,
            ), // Simule l'id client acquéreur
        })),
        { text: "Annuler", style: "cancel" },
      ],
    );
  };

  const processContractGeneration = async (lotId, clientId, lotNumber) => {
    setActionLoading(lotId);
    try {
      const res = await api.generateReservationDoc(lotId, clientId);

      Alert.alert(
        "Contrat créé avec succès !",
        `Le lot N° ${lotNumber} a été réservé. Souhaitez-vous visualiser le PDF généré par l'Express API ?`,
        [
          {
            text: "Télécharger / Ouvrir",
            onPress: () => Linking.openURL(res.pdfUrl),
          },
          { text: "Plus tard" },
        ],
      );

      // Rafraîchir les données
      fetchCommercialData();
    } catch (err) {
      Alert.alert("Erreur de génération", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const renderLotItem = ({ item }) => {
    let statusColor = colors.success; // Available
    let statusText = "Disponible";
    if (item.status === "reserved") {
      statusColor = colors.roles.promoteur; // Reserved
      statusText = "Réservé";
    } else if (item.status === "sold") {
      statusColor = colors.danger; // Sold
      statusText = "Vendu";
    }

    const isProcessing = actionLoading === item.id;

    return (
      <View style={styles.lotCard}>
        <View style={styles.lotHeader}>
          <Text style={styles.lotNum}>Lot {item.number}</Text>
          <View
            style={[
              styles.statusBadge,
              { borderColor: statusColor, backgroundColor: statusColor + "15" },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
        </View>

        <Text style={styles.lotProject}>
          {item.project?.name || "Résidence ATLAS"}
        </Text>
        <Text style={styles.lotType}>
          Modèle : {item.type} | Surface : ~100m²
        </Text>
        <Text style={styles.lotPrice}>
          {Number(item.price).toLocaleString()} DH
        </Text>

        {item.client && (
          <View style={styles.clientDetail}>
            <Text style={styles.clientLabel}>
              Acquéreur : {item.client.full_name || item.client.email}
            </Text>
            <Text style={styles.clientPhone}>
              Tél : {item.client.phone || "-"}
            </Text>
          </View>
        )}

        {item.status === "available" && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleGenerateContract(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.actionBtnText}>
                Réserver & Éditer contrat (Express PDF)
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLeadItem = ({ item }) => {
    return (
      <View style={styles.leadCard}>
        <View style={styles.leadHeader}>
          <Text style={styles.leadName}>{item.name}</Text>
          <View
            style={[
              styles.leadBadge,
              item.status === "Chaud"
                ? styles.leadChaud
                : item.status === "Nouveau"
                  ? styles.leadNouveau
                  : styles.leadTiede,
            ]}
          >
            <Text
              style={[
                styles.leadBadgeText,
                item.status === "Chaud"
                  ? { color: colors.danger }
                  : item.status === "Nouveau"
                    ? { color: colors.roles.ingenieur }
                    : { color: colors.roles.promoteur },
              ]}
            >
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.leadContact}>
          📧 {item.email} | 📞 {item.phone}
        </Text>
        <Text style={styles.leadProject}>
          Projet d'intérêt : {item.projectOfInterest}
        </Text>

        <View style={styles.logBox}>
          <Text style={styles.logTitle}>Dernier historique :</Text>
          <Text style={styles.logText}>{item.lastContact}</Text>
        </View>

        <TouchableOpacity
          style={styles.crmActionBtn}
          onPress={() =>
            Alert.alert(
              "Action CRM",
              `Interaction client enregistrée pour ${item.name}.`,
            )
          }
        >
          <Text style={styles.crmActionBtnText}>Ajouter note de suivi</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.roles.commercial} />
        <Text style={styles.loadingText}>
          Chargement du catalogue commercial...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.welcome}>Portefeuille Ventes</Text>
          <Text style={styles.roleTitle} numberOfLines={1} ellipsizeMode="tail">
            Agent Commercial : {user?.fullName || user?.email}
          </Text>
        </View>

        {route?.name === "Home" && (
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setMenuVisible(!menuVisible)}
          >
            <Text style={styles.profileBtnText}>Menu ☰</Text>
          </TouchableOpacity>
        )}

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

      {/* Dropdown Menu */}
      {menuVisible && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate("Profile");
            }}
          >
            <Text style={styles.dropdownItemText}>👤 Mon Profil</Text>
          </TouchableOpacity>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate("Profile");
            }}
          >
            <Text style={styles.dropdownItemText}>⚙️ Paramètres</Text>
          </TouchableOpacity>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuVisible(false);
              logout();
            }}
          >
            <Text style={[styles.dropdownItemText, { color: colors.danger }]}>
              🚪 Déconnexion
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "lots" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("lots")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "lots" && styles.tabButtonTextActive,
            ]}
          >
            Lot Grid & Ventes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "crm" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("crm")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "crm" && styles.tabButtonTextActive,
            ]}
          >
            Mini-CRM Leads
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* COMMISSIONS GAUGE WIDGET */}
        <View style={styles.commissionCard}>
          <Text style={styles.commHeader}>Estimation de Commission (2%)</Text>
          <Text style={styles.commSub}>
            Basée sur vos ventes validées et réservations en cours
          </Text>

          <View style={styles.commMetricRow}>
            <View>
              <Text style={styles.commVal}>
                {commissionInfo.estimatedComm.toLocaleString()} DH
              </Text>
              <Text style={styles.commLabel}>Commission Estimée</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.commSalesVal}>
                {commissionInfo.totalSales.toLocaleString()} DH
              </Text>
              <Text style={styles.commLabel}>Volume de Vente</Text>
            </View>
          </View>

          {/* Jauge commission */}
          <View style={styles.commGaugeBg}>
            <View
              style={[
                styles.commGaugeFill,
                {
                  width: `${Math.min((commissionInfo.estimatedComm / 100000) * 100, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.commTarget}>
            Objectif Commission Trimestrielle : 100,000 DH
          </Text>
        </View>

        {activeTab === "lots" ? (
          /* SECTION CATALOGUE */
          <View>
            {/* Filtres de lots */}
            <View style={styles.filtersContainer}>
              <Text style={styles.filterTitle}>Filtrer par statut :</Text>
              <View style={styles.filterButtonRow}>
                {["all", "available", "reserved", "sold"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterTag,
                      statusFilter === status && styles.filterTagActive,
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text
                      style={[
                        styles.filterTagText,
                        statusFilter === status && { color: colors.background },
                      ]}
                    >
                      {status === "all"
                        ? "Tous"
                        : status === "available"
                          ? "Dispo"
                          : status === "reserved"
                            ? "Réservé"
                            : "Vendu"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterTitle}>Projet :</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.projectFilterRow}
              >
                <TouchableOpacity
                  style={[
                    styles.projectFilterTag,
                    selectedProjectId === "all" &&
                      styles.projectFilterTagActive,
                  ]}
                  onPress={() => setSelectedProjectId("all")}
                >
                  <Text
                    style={[
                      styles.projectFilterTagText,
                      selectedProjectId === "all" && {
                        color: colors.background,
                      },
                    ]}
                  >
                    Tous les Projets
                  </Text>
                </TouchableOpacity>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.projectFilterTag,
                      selectedProjectId === p.id &&
                        styles.projectFilterTagActive,
                    ]}
                    onPress={() => setSelectedProjectId(p.id)}
                  >
                    <Text
                      style={[
                        styles.projectFilterTagText,
                        selectedProjectId === p.id && {
                          color: colors.background,
                        },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Grid des lots */}
            <FlatList
              data={filteredLots}
              keyExtractor={(item) => item.id}
              renderItem={renderLotItem}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Aucun lot correspondant à ces filtres.
                </Text>
              }
            />
          </View>
        ) : (
          /* SECTION MINI-CRM */
          <View>
            <View style={styles.alertBanner}>
              <Text style={styles.alertEmoji}>🔔</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.alertTitle}>Relance Urgente</Text>
                <Text style={styles.alertDesc}>
                  Rappeler Karim Alami aujourd'hui concernant le compromis de
                  vente.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionHeader}>
              Portefeuille Clients Actifs
            </Text>
            <FlatList
              data={leads}
              keyExtractor={(item) => item.id}
              renderItem={renderLeadItem}
              scrollEnabled={false}
            />
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
    color: colors.roles.commercial,
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
  dropdownMenu: {
    position: "absolute",
    top: 75,
    right: 20,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    width: 170,
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    padding: 6,
    borderRadius: 0,
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
    color: colors.roles.commercial,
  },
  scrollContainer: {
    padding: 16,
  },
  commissionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  commHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.text,
  },
  commSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  commMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  commVal: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.success,
  },
  commSalesVal: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  commLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  commGaugeBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  commGaugeFill: {
    height: "100%",
    backgroundColor: colors.success,
  },
  commTarget: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  filterButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  filterTag: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterTagActive: {
    backgroundColor: colors.roles.commercial,
    borderColor: colors.roles.commercial,
  },
  filterTagText: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.text,
  },
  projectFilterRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  projectFilterTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  projectFilterTagActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  projectFilterTagText: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.text,
  },
  lotCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  lotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  lotNum: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  lotProject: {
    fontSize: 13,
    color: colors.roles.commercial,
    fontWeight: "500",
    marginBottom: 4,
  },
  lotType: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  lotPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
  },
  clientDetail: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  clientLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.text,
  },
  clientPhone: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnText: {
    color: colors.text,
    fontWeight: "bold",
    fontSize: 12,
  },
  leadCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  leadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  leadName: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.text,
  },
  leadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  leadBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  leadChaud: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: colors.danger,
  },
  leadNouveau: {
    backgroundColor: "rgba(6, 182, 212, 0.1)",
    borderColor: colors.roles.ingenieur,
  },
  leadTiede: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: colors.roles.promoteur,
  },
  leadContact: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  leadProject: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  logBox: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  logText: {
    fontSize: 11,
    color: colors.text,
    marginTop: 2,
  },
  crmActionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  crmActionBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "bold",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  alertEmoji: {
    fontSize: 20,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.danger,
  },
  alertDesc: {
    fontSize: 11,
    color: colors.text,
    marginTop: 1,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    marginVertical: 20,
  },
});
