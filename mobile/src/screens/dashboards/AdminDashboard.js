import React, { useState, useEffect, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { AuthContext } from "../../context/AuthContext";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";

export default function AdminDashboard({ navigation, route }) {
  const { user, logout } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeProjects: 0,
    systemStatus: "Inconnu",
  });
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminPage();
      setStats(
        res.data?.stats || {
          totalUsers: 42,
          activeProjects: 5,
          systemStatus: "En ligne",
        },
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de récupérer les statistiques admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.welcome}>Supervision Admin</Text>
          <Text style={styles.roleTitle} numberOfLines={1} ellipsizeMode="tail">
            Administrateur : {user?.fullName || user?.email}
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

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {loading ? (
          <ActivityIndicator
            color={colors.roles.admin}
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            {/* System Status Card */}
            <View
              style={[
                styles.statusCard,
                {
                  borderColor:
                    stats.systemStatus === "En ligne"
                      ? colors.success
                      : colors.danger,
                },
              ]}
            >
              <Text style={styles.cardHeader}>État du Système</Text>
              <Text
                style={[
                  styles.statusVal,
                  {
                    color:
                      stats.systemStatus === "En ligne"
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              >
                ● {stats.systemStatus.toUpperCase()}
              </Text>
            </View>

            {/* Statistiques Métriques */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats.totalUsers}</Text>
                <Text style={styles.statLabel}>Utilisateurs</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats.activeProjects}</Text>
                <Text style={styles.statLabel}>Projets Actifs</Text>
              </View>
            </View>

            {/* Quick Actions / Simulations */}
            <Text style={styles.sectionTitle}>
              Raccourcis de contrôle (RBAC)
            </Text>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => navigation.navigate("PromoterDashboard")}
            >
              <Text style={styles.controlBtnText}>
                Accéder à l'Espace Promoteur
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => navigation.navigate("EngineerDashboard")}
            >
              <Text style={styles.controlBtnText}>
                Accéder au Suivi Technique (Ingénieur)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => navigation.navigate("CommercialDashboard")}
            >
              <Text style={styles.controlBtnText}>
                Accéder au Catalogue (Commercial)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => navigation.navigate("ClientDashboard")}
            >
              <Text style={styles.controlBtnText}>Accéder à la vue Client</Text>
            </TouchableOpacity>
          </>
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
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
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
    backgroundColor: colors.card,
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
  welcome: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.roles.admin,
  },
  roleTitle: {
    fontSize: 14,
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
    fontSize: 14,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statusVal: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  statBox: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statNum: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
  },
  controlBtn: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  controlBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
