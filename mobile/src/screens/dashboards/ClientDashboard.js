import React, { useState, useEffect, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
  Alert,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { AuthContext } from "../../context/AuthContext";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";

const DUBAI_IMAGES = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80",
    title: "Luxury Dubai Design - Façade",
    desc: "Rendu 3D de la façade principale, mêlant modernisme et élégance dubaïote.",
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80",
    title: "Piscine & Espace Extérieur",
    desc: "Piscine lagon privée entourée de palmiers sous le soleil de Dubaï.",
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
    title: "Intérieur Penthouse de Prestige",
    desc: "Salon de réception luxueux avec de grandes baies vitrées.",
  },
  {
    id: "4",
    url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
    title: "Rooftop d'Exception",
    desc: "Terrasse supérieure et jacuzzi avec panorama sur la skyline.",
  },
];

export default function ClientDashboard({ navigation, route }) {
  const { user, logout } = useContext(AuthContext);
  const [menuVisible, setMenuVisible] = useState(false);

  // États de l'application
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [paymentMetrics, setPaymentMetrics] = useState(null);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // États du planificateur de réunion
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // États de la galerie 3D Luxury Dubai
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const changeImage = (newIndex) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveImageIndex(newIndex);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeImageIndex + 1) % DUBAI_IMAGES.length;
      changeImage(nextIndex);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeImageIndex]);

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les projets pour identifier celui du client (simulé ou par défaut)
      const projRes = await api.getProjects();
      const currentProj = projRes.projects[0] || {
        id: "default",
        name: "Résidence ATLAS",
        location: "Casablanca",
        latitude: 33.5731,
        longitude: -7.5898,
      };
      setProject(currentProj);

      // 2. Récupérer les jalons du projet
      if (currentProj.id) {
        const milestoneRes = await api.getMilestones(currentProj.id);
        const list = milestoneRes.milestones || [];
        setMilestones(list);

        // Calculer l'avancement
        if (list.length > 0) {
          const totalProgress = list.reduce(
            (acc, cur) => acc + Number(cur.progress_percent),
            0,
          );
          setProgressPercent(Math.round(totalProgress / list.length));
        } else {
          setProgressPercent(65); // Fictif par défaut
        }

        // Récupérer la météo réelle du chantier
        fetchWeather(
          currentProj.latitude || 33.5731,
          currentProj.longitude || -7.5898,
        );
      }

      // 3. Récupérer les données de paiement et jauges
      const gaugeRes = await api.getPaymentGauge(user.id);
      setPaymentMetrics(gaugeRes.metrics);

      const paymentRes = await api.getPayments();
      setPayments(paymentRes.payments || []);

      // 4. Récupérer les documents du coffre-fort
      const docsRes = await api.getDocuments();
      setDocuments(docsRes.documents || []);
    } catch (error) {
      console.error("Erreur ClientDashboard fetch:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Récupération de la météo réelle en temps réel via l'API Open-Meteo
  const fetchWeather = async (lat, lon) => {
    setWeatherLoading(true);
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      );
      const data = await response.json();
      if (data && data.current_weather) {
        setWeather(data.current_weather);
      }
    } catch (err) {
      console.warn("Impossible de charger la météo réelle:", err.message);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleOpenReceipt = (url) => {
    if (!url) {
      Alert.alert(
        "Indisponible",
        "Le reçu de ce paiement n'a pas encore été généré ou téléversé.",
      );
      return;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert("Erreur", "Impossible d'ouvrir l'adresse URL."),
    );
  };

  const handleScheduleMeeting = () => {
    if (!meetingDate || !meetingTime || !meetingSubject) {
      Alert.alert(
        "Champs requis",
        "Veuillez saisir une date, une heure et le motif du rendez-vous.",
      );
      return;
    }
    setScheduling(true);
    setTimeout(() => {
      setScheduling(false);
      Alert.alert(
        "Rendez-vous planifié",
        `Votre demande de rendez-vous pour le ${meetingDate} à ${meetingTime} a bien été enregistrée. Le conseiller Amine Bennani vous recontactera rapidement.`,
        [
          {
            text: "Super",
            onPress: () => {
              setMeetingDate("");
              setMeetingTime("");
              setMeetingSubject("");
            },
          },
        ],
      );
    }, 1200);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.roles.client} />
        <Text style={styles.loadingText}>
          Chargement de votre espace acquéreur...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.welcome}>Mon Espace Client</Text>
          <Text style={styles.roleTitle} numberOfLines={1} ellipsizeMode="tail">
            Acquéreur : {user?.fullName || user?.email}
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
        {/* SECTION 1 : ETAT D'AVANCEMENT & TIMELINE */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>Suivi de Construction</Text>
          <Text style={styles.projectName}>
            {project?.name} - {project?.location}
          </Text>

          {/* Galerie d'images 3D Luxury Dubai */}
          <View style={styles.carouselContainer}>
            <View style={styles.imageWrapper}>
              <Animated.Image
                source={{ uri: DUBAI_IMAGES[activeImageIndex].url }}
                style={[
                  styles.carouselImage,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
                resizeMode="cover"
              />
              <View style={styles.textOverlay}>
                <Text style={styles.carouselTitle}>
                  {DUBAI_IMAGES[activeImageIndex].title}
                </Text>
                <Text style={styles.carouselDesc} numberOfLines={2}>
                  {DUBAI_IMAGES[activeImageIndex].desc}
                </Text>
              </View>

              {/* Bouton Gauche */}
              <TouchableOpacity
                style={[styles.navButton, styles.leftButton]}
                onPress={() => {
                  const nextIndex =
                    (activeImageIndex - 1 + DUBAI_IMAGES.length) %
                    DUBAI_IMAGES.length;
                  changeImage(nextIndex);
                }}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>

              {/* Bouton Droit */}
              <TouchableOpacity
                style={[styles.navButton, styles.rightButton]}
                onPress={() => {
                  const nextIndex = (activeImageIndex + 1) % DUBAI_IMAGES.length;
                  changeImage(nextIndex);
                }}
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Indicateurs (Dots) */}
            <View style={styles.dotsContainer}>
              {DUBAI_IMAGES.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dot,
                    index === activeImageIndex
                      ? styles.activeDot
                      : styles.inactiveDot,
                  ]}
                  onPress={() => {
                    if (index !== activeImageIndex) {
                      changeImage(index);
                    }
                  }}
                />
              ))}
            </View>
          </View>

          {/* Jauge d'avancement globale */}
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              Avancement global : {progressPercent}%
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
          </View>

          {/* Timeline Milestones */}
          <Text style={styles.subHeader}>Chronologie des Jalons</Text>
          {milestones.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun jalon défini pour ce projet.
            </Text>
          ) : (
            milestones.map((item, idx) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timelineIndicators}>
                  <View
                    style={[
                      styles.timelineDot,
                      item.is_validated
                        ? styles.timelineDotActive
                        : styles.timelineDotInactive,
                    ]}
                  />
                  {idx < milestones.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineTitle,
                      item.is_validated
                        ? styles.textActive
                        : styles.textInactive,
                    ]}
                  >
                    {item.title} {item.is_validated && "✓"}
                  </Text>
                  <Text style={styles.timelineDesc}>{item.description}</Text>
                  {item.validated_at && (
                    <Text style={styles.validationDate}>
                      Validé le{" "}
                      {new Date(item.validated_at).toLocaleDateString("fr-FR")}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* SECTION 2 : METEO DU CHANTIER */}
        <View style={styles.weatherCard}>
          <Text style={styles.weatherCardHeader}>☀️ Météo du Chantier</Text>
          {weatherLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : weather ? (
            <View style={styles.weatherInfoRow}>
              <View>
                <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
                <Text style={styles.weatherLocation}>
                  Localisation GPS : {project?.latitude}, {project?.longitude}
                </Text>
              </View>
              <View style={styles.weatherDetailRight}>
                <Text style={styles.weatherText}>
                  Vents : {weather.windspeed} km/h
                </Text>
                <Text style={styles.weatherStatus}>
                  {weather.temperature > 30
                    ? "Chaud / Favorable"
                    : weather.temperature > 15
                      ? "Clément"
                      : "Frais"}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Météo indisponible.</Text>
          )}
        </View>

        {/* SECTION 3 : FINANCIER & GAUGE DE PAIEMENT */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>État de mes Paiements</Text>

          {paymentMetrics ? (
            <View style={styles.gaugeContainer}>
              <View style={styles.gaugeStats}>
                <View style={styles.gaugeStatBox}>
                  <Text style={styles.gaugeVal}>
                    {Number(paymentMetrics.totalLotValue).toLocaleString()} DH
                  </Text>
                  <Text style={styles.gaugeLbl}>Prix Total Lot</Text>
                </View>
                <View style={styles.gaugeStatBox}>
                  <Text style={[styles.gaugeVal, { color: colors.success }]}>
                    {Number(paymentMetrics.totalPaid).toLocaleString()} DH
                  </Text>
                  <Text style={styles.gaugeLbl}>Somme Versée</Text>
                </View>
                <View style={styles.gaugeStatBox}>
                  <Text
                    style={[styles.gaugeVal, { color: colors.roles.promoteur }]}
                  >
                    {Number(paymentMetrics.remainingToPay).toLocaleString()} DH
                  </Text>
                  <Text style={styles.gaugeLbl}>Reste dû</Text>
                </View>
              </View>

              {/* Barre de gauge financière */}
              <View style={styles.gaugeBarBg}>
                <View
                  style={[
                    styles.gaugeBarFill,
                    {
                      width: `${paymentMetrics.totalLotValue > 0 ? (paymentMetrics.totalPaid / paymentMetrics.totalLotValue) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Liste des paiements / appels de fonds */}
          <Text style={styles.subHeader}>Historique des Appels de fonds</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucune facture ou appel de fonds émis.
            </Text>
          ) : (
            payments.map((p) => {
              const isPaid = p.status === "paid";
              const isOverdue = p.status === "overdue";
              return (
                <View key={p.id} style={styles.paymentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentTitle}>
                      Étape Chantier (10%)
                    </Text>
                    <Text style={styles.paymentAmount}>
                      {Number(p.amount).toLocaleString()} DH
                    </Text>
                    <Text style={styles.paymentDue}>
                      Échéance :{" "}
                      {new Date(p.due_date).toLocaleDateString("fr-FR")}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View
                      style={[
                        styles.statusBadge,
                        isPaid
                          ? styles.badgePaid
                          : isOverdue
                            ? styles.badgeOverdue
                            : styles.badgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isPaid
                            ? { color: colors.success }
                            : isOverdue
                              ? { color: colors.danger }
                              : { color: colors.warning },
                        ]}
                      >
                        {isPaid ? "PAYÉ" : isOverdue ? "EN RETARD" : "À PAYER"}
                      </Text>
                    </View>
                    {isPaid && (
                      <TouchableOpacity
                        style={styles.receiptBtn}
                        onPress={() => handleOpenReceipt(p.receipt_url)}
                      >
                        <Text style={styles.receiptBtnText}>PDF Reçu 📥</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* SECTION 4 : COFFRE FORT NUMERIQUE */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>📂 Mon Coffre-Fort Numérique</Text>
          <Text style={styles.cardDescription}>
            Documents officiels et plans chantiers sécurisés en lecture seule.
          </Text>

          {documents.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun document déposé dans votre coffre-fort.
            </Text>
          ) : (
            documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docRow}
                onPress={() => handleOpenReceipt(doc.file_url)}
              >
                <View style={styles.docIcon}>
                  <Text style={styles.docIconText}>📄</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>
                    Format : PDF | Déposé le{" "}
                    {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                  </Text>
                </View>
                <Text style={styles.downloadIcon}>⬇️</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* SECTION 5 : PLANIFICATEUR DE REUNION */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>🤝 Contacter mon Conseiller</Text>
          <Text style={styles.cardDescription}>
            Prenez rendez-vous directement avec Amine Bennani (Sales Agent).
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Date souhaitée (ex: 15/09/2026)"
              placeholderTextColor={colors.textMuted}
              value={meetingDate}
              onChangeText={setMeetingDate}
            />
            <TextInput
              style={styles.input}
              placeholder="Heure souhaitée (ex: 14:30)"
              placeholderTextColor={colors.textMuted}
              value={meetingTime}
              onChangeText={setMeetingTime}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Objet du rendez-vous (ex: Questions sur les finitions)"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
              value={meetingSubject}
              onChangeText={setMeetingSubject}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleScheduleMeeting}
              disabled={scheduling}
            >
              {scheduling ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitBtnText}>
                  Demander le rendez-vous
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    fontSize: 15,
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
    color: colors.roles.client,
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
  scrollContainer: {
    padding: 16,
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
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
  },
  projectName: {
    fontSize: 13,
    color: colors.roles.client,
    fontWeight: "bold",
    marginBottom: 12,
  },
  progressRow: {
    marginBottom: 16,
  },
  progressText: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "500",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.roles.client,
  },
  subHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 14,
  },
  timelineIndicators: {
    alignItems: "center",
    marginRight: 12,
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 4,
  },
  timelineDotActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  timelineDotInactive: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
    marginBottom: -14,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 8,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  timelineDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  validationDate: {
    fontSize: 10,
    color: colors.success,
    marginTop: 3,
  },
  textActive: {
    color: colors.text,
  },
  textInactive: {
    color: colors.textMuted,
  },
  weatherCard: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#38BDF8", // Accent Cyan/Bleu pour la météo
    marginBottom: 20,
  },
  weatherCardHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#38BDF8",
    marginBottom: 8,
  },
  weatherInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherTemp: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.text,
  },
  weatherLocation: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  weatherDetailRight: {
    alignItems: "flex-end",
  },
  weatherText: {
    fontSize: 12,
    color: colors.text,
  },
  weatherStatus: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.success,
    marginTop: 4,
  },
  gaugeContainer: {
    marginVertical: 8,
  },
  gaugeStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gaugeStatBox: {
    width: "32%",
    alignItems: "center",
  },
  gaugeVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
  },
  gaugeLbl: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  gaugeBarBg: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
  },
  gaugeBarFill: {
    height: "100%",
    backgroundColor: colors.success,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginVertical: 2,
  },
  paymentDue: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  badgePaid: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: colors.success,
  },
  badgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: colors.warning,
  },
  badgeOverdue: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: colors.danger,
  },
  receiptBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  receiptBtnText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "bold",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  docIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  docIconText: {
    fontSize: 16,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.text,
  },
  docMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  downloadIcon: {
    fontSize: 16,
  },
  form: {
    marginTop: 4,
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
    height: 60,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: colors.roles.client,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  submitBtnText: {
    color: colors.text,
    fontWeight: "bold",
    fontSize: 14,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginVertical: 10,
  },
  carouselContainer: {
    marginVertical: 14,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  imageWrapper: {
    position: "relative",
    height: 180,
    width: "100%",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: 12,
  },
  carouselImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: 180,
  },
  textOverlay: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  carouselTitle: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "bold",
  },
  carouselDesc: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
  },
  navButton: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  leftButton: {
    left: 8,
  },
  rightButton: {
    right: 8,
  },
  navButtonText: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "bold",
    lineHeight: 24,
    textAlign: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#1E293B",
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 16,
    backgroundColor: "#8B5CF6",
  },
  inactiveDot: {
    width: 6,
    backgroundColor: "#475569",
  },
});
