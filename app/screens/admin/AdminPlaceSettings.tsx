import { db, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import QRCodeLib from "qrcode";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import ColorPicker, { HueSlider, Panel1, Preview } from "reanimated-color-picker";
import { useTheme } from "../../context/ThemeContext";
import { LocationMode, Place, Sector, Zone } from "../../types/order.types";

const PRESET_COLORS = [
  { hex: "#0891B2", label: "Plava" },
  { hex: "#0E7C86", label: "Teal" },
  { hex: "#059669", label: "Zelena" },
  { hex: "#16A34A", label: "Šuma" },
  { hex: "#2563EB", label: "Kobalt" },
  { hex: "#4F46E5", label: "Indigo" },
  { hex: "#7C3AED", label: "Ljubičasta" },
  { hex: "#9333EA", label: "Vijoleta" },
  { hex: "#EC4899", label: "Roza" },
  { hex: "#E11D48", label: "Crvena" },
  { hex: "#EA580C", label: "Narandžasta" },
  { hex: "#D97706", label: "Zlatna" },
];

const SECTOR_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "restaurant-outline", "cafe-outline", "pizza-outline", "fast-food-outline",
  "ice-cream-outline", "flame-outline", "fish-outline", "leaf-outline",
  "nutrition-outline", "basket-outline", "cart-outline", "bag-outline",
  "storefront-outline", "home-outline", "business-outline", "bed-outline",
  "people-outline", "person-outline", "star-outline", "heart-outline",
  "trophy-outline", "medal-outline", "ribbon-outline", "gift-outline",
  "water-outline", "cut-outline", "thermometer-outline", "time-outline",
  "calendar-outline", "receipt-outline", "cash-outline", "card-outline",
  "bag-handle-outline", "bicycle-outline", "car-outline", "map-outline",
  "pin-outline", "sunny-outline", "umbrella-outline", "flower-outline",
  "key-outline", "grid-outline", "layers-outline", "bookmark-outline",
];

interface Props {
  placeId: string;
  onMenuPress?: () => void;
}

const MODE_OPTIONS: { value: LocationMode; label: string; desc: string }[] = [
  { value: "none", label: "Ništa", desc: "Konobar ne bira lokaciju" },
  { value: "zones", label: "Samo zone", desc: "Konobar bira zonu (Sala, Terasa...)" },
  { value: "tables", label: "Samo stolovi", desc: "Konobar bira broj stola" },
  { value: "zones_tables", label: "Zone + stolovi", desc: "Konobar bira zonu pa sto" },
];

export default function AdminPlaceSettings({ placeId, onMenuPress }: Props) {
  const { darkMode, primaryColor, setPrimaryColor } = useTheme();
  const { t } = useTranslation();

  const D = darkMode ? {
    root: "#111827",
    headerBg: "#1F2937",
    headerBorder: "#374151",
    headerTitle: "#F9FAFB",
    hamburgerBox: "#374151",
    card: "#1F2937",
    cardBorder: "#374151",
    cardTitle: "#6B7280",
    infoText: "#E5E7EB",
    infoLabel: "#9CA3AF",
    sectionTitle: "#F3F4F6",
    sectionHint: "#6B7280",
    modeCard: "#1F2937",
    modeCardBorder: "#374151",
    modeLabel: "#E5E7EB",
    modeDesc: "#6B7280",
    modeRadioBorder: "#4B5563",
    zoneCard: "#1F2937",
    zoneCardBorder: "#374151",
    input: "#1F2937",
    inputBorder: "#374151",
    inputText: "#E5E7EB",
    placeholder: "#6B7280",
    tablePreview: "#6B7280",
    tableCountBox: "#111827",
    tableCountBorder: "#374151",
    iconPickerScroll: "#1a2637",
    iconPickerBorder: "#374151",
    iconPickerItem: "#374151",
    iconPickerItemBorder: "#4B5563",
    sectorIconBtn: "#374151",
    unsavedBannerBg: "#78350F",
    unsavedBannerBorder: "#92400E",
    unsavedBannerText: "#FDE68A",
  } : {
    root: "#f9f9f9",
    headerBg: "#fff",
    headerBorder: "#F0F0F0",
    headerTitle: "#18181B",
    hamburgerBox: "#F0FDFA",
    card: "#fff",
    cardBorder: "#eee",
    cardTitle: "#888",
    infoText: "#333",
    infoLabel: "#555",
    sectionTitle: "#222",
    sectionHint: "#888",
    modeCard: "#fff",
    modeCardBorder: "#e5e5e5",
    modeLabel: "#444",
    modeDesc: "#888",
    modeRadioBorder: "#ccc",
    zoneCard: "#fff",
    zoneCardBorder: "#e5e5e5",
    input: "#fff",
    inputBorder: "#ddd",
    inputText: "#1a1a1a",
    placeholder: "#A1A1AA",
    tablePreview: "#888",
    tableCountBox: "#f0fafb",
    tableCountBorder: "#b2dfdf",
    iconPickerScroll: "#f0fafb",
    iconPickerBorder: "#b2dfdf",
    iconPickerItem: "#fff",
    iconPickerItemBorder: "#ddd",
    sectorIconBtn: "#e8f8f9",
    unsavedBannerBg: "#fff3cd",
    unsavedBannerBorder: "#ffc107",
    unsavedBannerText: "#856404",
  };

  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);

  const [place, setPlace] = useState<Place | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("zones");
  const [zones, setZones] = useState<Zone[]>([]);
  const [tableCount, setTableCount] = useState("0");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState<string | null>(null);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const qrRef = useRef<any>(null);
  const [pendingColor, setPendingColor] = useState(primaryColor);
  const savedOpacity = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValidHex = (h: string) => /^#[0-9A-Fa-f]{6}$/.test(h);

  const applyColor = async (hex: string) => {
    if (!isValidHex(hex)) return;
    setPrimaryColor(hex);
    if (placeId) {
      try { await updateDoc(doc(db, placesRoot(), placeId), { primaryColor: hex }); } catch {}
    }
  };

  const showSavedBanner = () => {
    setSavedMsg(true);
    Animated.sequence([
      Animated.timing(savedOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(savedOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setSavedMsg(false));
  };

  // Warn on browser tab/window close when dirty (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!placeId) return;
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), d => {
      if (!d.exists()) return;
      const data = d.data() as Omit<Place, "id">;
      setPlace({ id: d.id, ...data });
      setLocationMode(data.locationMode ?? "zones");
      const rawZones: any[] = data.zones ?? [];
      setZones(rawZones.map(z => typeof z === "string" ? { name: z, tableCount: 0 } : z));
      setTableCount(String(data.tableCount ?? 0));
      setSectors(data.sectors ?? []);
      setDirty(false);
    });
    return unsub;
  }, [placeId]);

  const handleSave = async () => {
    if (!placeId) return;
    const tc = parseInt(tableCount) || 0;
    setSaving(true);
    try {
      await updateDoc(doc(db, placesRoot(), placeId), {
        locationMode,
        zones,
        tableCount: tc,
        sectors,
      });
      setDirty(false);
      showSavedBanner();
    } catch {
      Alert.alert(t("common.error"), t("adminSettings.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const addZone = () => { setZones(prev => [...prev, { name: "", tableCount: 0 }]); setDirty(true); };
  const updateZone = (i: number, field: keyof Zone, val: string | number) => {
    setZones(prev => prev.map((z, idx) => idx === i ? { ...z, [field]: val } : z));
    setDirty(true);
  };
  const removeZone = (i: number) => { setZones(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };

  const addSector = () => {
    const id = `sector_${Date.now()}`;
    setSectors(prev => [...prev, { id, name: "", icon: "wine-outline" }]);
    setDirty(true);
    setIconPickerOpen(id);
  };
  const updateSector = (i: number, field: keyof Sector, val: string) => {
    setSectors(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
    setDirty(true);
  };
  const removeSector = (i: number) => {
    setSectors(prev => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const showZones = locationMode === "zones" || locationMode === "zones_tables";
  const showPerZoneTables = locationMode === "zones_tables";
  const showGlobalTables = locationMode === "tables";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: D.root }}>
      {/* â”€â”€ HEADER â”€â”€ */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: D.headerBg,
        paddingHorizontal: 8, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: D.headerBorder,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
      }}>
        <Pressable onPress={onMenuPress} hitSlop={12} style={{ padding: 6 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: D.hamburgerBox, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="menu" size={20} color={primaryColor} />
          </View>
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: D.headerTitle, letterSpacing: -0.3 }}>{t("adminSettings.title")}</Text>
        <View style={{ width: 44 }} />
      </View>
      {/* Unsaved changes banner */}
      {dirty && (
        <View style={[styles.unsavedBanner, { backgroundColor: D.unsavedBannerBg, borderBottomColor: D.unsavedBannerBorder }]}>
          <Text style={[styles.unsavedBannerText, { color: D.unsavedBannerText }]}>{t("adminSettings.unsavedChanges")}</Text>
        </View>
      )}

      {/* Success banner */}
      {savedMsg && (
        <Animated.View style={[styles.savedBanner, { opacity: savedOpacity }]}>
          <Text style={styles.savedBannerText}>{t("adminSettings.savedSuccess")}</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Osnovne informacije */}
        {place && (
          <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: D.cardTitle }]}>{t("adminSettings.placeSection")}</Text>
            <Text style={[styles.infoRow, { color: D.infoText }]}>
              <Text style={[styles.infoLabel, { color: D.infoLabel }]}>{t("adminSettings.nameLabel")}</Text>{place.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: D.infoLabel }]}>{t("adminSettings.joinCode")}</Text>
                <Text style={styles.joinCode}>{place.joinCode}</Text>
              </View>
              <Pressable
                onPress={async () => {
                  const joinUrl = Platform.OS === "web"
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${place.joinCode}`
                    : `ordea://join?code=${place.joinCode}`;
                  const message = `Pridruži se objektu "${place.name}" na Ordea:\n${joinUrl}`;
                  // Web Share API — radi na mobilnim browserima i PWA (WhatsApp, Viber, SMS...)
                  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
                    try {
                      await navigator.share({ title: `Ordea – ${place.name}`, text: message, url: joinUrl });
                    } catch {
                      // Korisnik otkazao dijeljenje — ništa ne radimo
                    }
                  } else if (Platform.OS === "web") {
                    // Fallback za desktop browser koji ne podržava Web Share API
                    await Clipboard.setStringAsync(joinUrl);
                    Alert.alert(t("adminSettings.copiedLink"), t("adminSettings.copiedLinkMsg"));
                  } else {
                    await Share.share({ message, url: joinUrl });
                  }
                }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: primaryColor + "18",
                  borderWidth: 1, borderColor: primaryColor + "50",
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                }}
              >
                <Ionicons name="share-social-outline" size={16} color={primaryColor} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: primaryColor }}>
                  {t("adminSettings.share")}
                </Text>
              </Pressable>
            </View>

            {/* QR kod — collapsible */}
            <Pressable
              onPress={() => setQrVisible(v => !v)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                marginTop: 12,
                paddingVertical: 10, paddingHorizontal: 12,
                backgroundColor: qrVisible ? primaryColor + "12" : (darkMode ? "#374151" : "#F3F4F6"),
                borderRadius: 10,
                borderWidth: 1,
                borderColor: qrVisible ? primaryColor + "40" : "transparent",
              }}
            >
              <Ionicons name="qr-code-outline" size={18} color={qrVisible ? primaryColor : D.sectionHint} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: qrVisible ? primaryColor : D.infoText }}>
                {t("adminSettings.qrCode")}
              </Text>
              <Ionicons name={qrVisible ? "chevron-up" : "chevron-down"} size={16} color={D.sectionHint} />
            </Pressable>

            {qrVisible && (() => {
              const joinUrl = Platform.OS === "web"
                ? `${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${place.joinCode}`
                : `ordea://join?code=${place.joinCode}`;
              const handlePrint = async () => {
                if (Platform.OS !== "web" || typeof window === "undefined") return;
                const dataURL = await QRCodeLib.toDataURL(joinUrl, { width: 300, margin: 2 });
                const win = window.open("", "_blank");
                if (!win) return;
                win.document.write(`
                  <html><head><title>Ordea \u2013 ${place.name}</title>
                  <style>
                    @media print { @page { margin: 20mm; } }
                    body{font-family:sans-serif;text-align:center;padding:48px;color:#111}
                    h2{font-size:28px;font-weight:800;margin-bottom:8px}
                    .subtitle{color:#555;font-size:15px;margin-bottom:24px}
                    img{display:block;margin:0 auto;border:1px solid #eee;border-radius:12px;padding:12px}
                    .or{color:#999;font-size:14px;margin:20px 0 8px}
                    .code{font-size:36px;font-weight:800;letter-spacing:8px;color:#111}
                    .footer{margin-top:28px;font-size:12px;color:#aaa}
                  </style></head>
                  <body>
                    <h2>${place.name}</h2>
                    <p class="subtitle">Skeniraj QR kod kamerom telefona da se prijavi\u0161 bez koda</p>
                    <img src="${dataURL}" width="220" height="220" />
                    <p class="or">ili upi\u0161i join kod:</p>
                    <div class="code">${place.joinCode}</div>
                    <p class="footer">Ordea \u2013 sistem narud\u017ebi</p>
                    <script>setTimeout(()=>{window.print();},300);<\/script>
                  </body></html>
                `);
                win.document.close();
              };
              return (
                <View style={{ alignItems: "center", gap: 12, marginTop: 16, paddingBottom: 4 }}>
                  <View style={{
                    padding: 16, backgroundColor: "#fff",
                    borderRadius: 16, shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08,
                    shadowRadius: 8, elevation: 3,
                  }}>
                    <QRCode
                      getRef={(ref: any) => { qrRef.current = ref; }}
                      value={joinUrl}
                      size={180}
                      color="#111827"
                      backgroundColor="#fff"
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: D.sectionHint, textAlign: "center", maxWidth: 240, lineHeight: 18 }}>
                    Radnik skenira kamerom telefona → stranica se otvori → odabere ulogu. Nema unosa koda.
                  </Text>
                  {Platform.OS === "web" && (
                    <Pressable
                      onPress={handlePrint}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        borderWidth: 1.5, borderColor: darkMode ? "#4B5563" : "#D1D5DB",
                        borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9,
                      }}
                    >
                      <Ionicons name="print-outline" size={16} color={D.infoText} />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: D.infoText }}>{t("adminSettings.printQr") ?? "Print QR code"}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* Mod lokacije */}
        <Text style={[styles.sectionTitle, { color: D.sectionTitle }]}>{t("adminSettings.locationTitle") ?? "Location selection"}</Text>
        <Text style={[styles.sectionHint, { color: D.sectionHint }]}>
          {t("adminSettings.locationHint") ?? "Determines what the waiter selects before sending an order."}
        </Text>

        {MODE_OPTIONS.map(opt => {
          const modeLabels: Record<string, string> = {
            none: t("adminSettings.locationNone"),
            zones: t("adminSettings.locationZones"),
            tables: t("adminSettings.locationTables"),
            zones_tables: t("adminSettings.locationZonesTables"),
          };
          const modeDescs: Record<string, string> = {
            none: t("adminSettings.locationNoneDesc"),
            zones: t("adminSettings.locationZonesDesc"),
            tables: t("adminSettings.locationTablesDesc"),
            zones_tables: t("adminSettings.locationZonesTablesDesc"),
          };
          return (
          <Pressable
            key={opt.value}
            onPress={() => { setLocationMode(opt.value); setDirty(true); }}
            style={[styles.modeCard, { backgroundColor: D.modeCard, borderColor: locationMode === opt.value ? primaryColor : D.modeCardBorder }, locationMode === opt.value && styles.modeCardActive]}
          >
            <View style={[styles.modeRadio, { borderColor: locationMode === opt.value ? primaryColor : D.modeRadioBorder }]}>
              {locationMode === opt.value && <View style={styles.modeRadioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeLabel, { color: locationMode === opt.value ? primaryColor : D.modeLabel }]}>
                {modeLabels[opt.value] ?? opt.label}
              </Text>
              <Text style={[styles.modeDesc, { color: D.modeDesc }]}>{modeDescs[opt.value] ?? opt.desc}</Text>
            </View>
          </Pressable>
          );
        })}

        {/* Zone */}
        {showZones && (
          <>
            <Text style={[styles.sectionTitle, { color: D.sectionTitle }]}>
              {showPerZoneTables ? t("adminSettings.zonesAndTables") ?? "Zones and tables" : t("adminSettings.zones") ?? "Zones"}
            </Text>
            {showPerZoneTables && (
              <Text style={[styles.sectionHint, { color: D.sectionHint }]}>{t("adminSettings.zonesHint") ?? "Enter zone name and number of tables in that zone."}</Text>
            )}
            {zones.map((z, i) => (
              <View key={i} style={[styles.zoneCard, { backgroundColor: D.zoneCard, borderColor: D.zoneCardBorder }]}>
                <View style={styles.zoneCardRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
                    value={z.name}
                    onChangeText={v => updateZone(i, "name", v)}
                    placeholder={`${t("adminSettings.zonePlaceholder") ?? "Zone"} ${i + 1}`}
                    placeholderTextColor={D.placeholder}
                  />
                  {showPerZoneTables && (
                    <View style={[styles.tableCountBox, { backgroundColor: D.tableCountBox, borderColor: D.tableCountBorder }]}>
                      <Text style={styles.tableCountLabel}>{t("adminSettings.tables") ?? "Tables"}</Text>
                      <TextInput
                        style={[styles.tableCountInput]}
                        value={z.tableCount > 0 ? String(z.tableCount) : ""}
                        onChangeText={v => updateZone(i, "tableCount", parseInt(v) || 0)}
                        keyboardType="number-pad"
                        placeholder="0"
                      />
                    </View>
                  )}
                  <Pressable onPress={() => removeZone(i)} style={styles.removeBtn}>
                    <Ionicons name="close" size={16} color="#ef4444" />
                  </Pressable>
                </View>
                {showPerZoneTables && z.tableCount > 0 && (
                  <Text style={[styles.tablePreview, { color: D.tablePreview }]}>
                    Stolovi: {Array.from({ length: Math.min(z.tableCount, 6) }, (_, k) => k + 1).join(", ")}
                    {z.tableCount > 6 ? ` ... ${z.tableCount}` : ""}
                  </Text>
                )}
              </View>
            ))}
            <Pressable onPress={addZone} style={styles.addBtn}>
              <Text style={styles.addBtnText}>{t("adminSettings.addZone")}</Text>
            </Pressable>
          </>
        )}

        {/* Globalni stolovi (samo "tables" mod) */}
        {showGlobalTables && (
          <>
            <Text style={[styles.sectionTitle, { color: D.sectionTitle }]}>{t("adminSettings.tablesCount") ?? "Number of tables"}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
              value={tableCount}
              onChangeText={v => { setTableCount(v); setDirty(true); }}
              keyboardType="number-pad"
              placeholder={t("adminSettings.tablesPlaceholder") ?? "e.g. 20"}
              placeholderTextColor={D.placeholder}
            />
            {parseInt(tableCount) > 0 && (
              <Text style={[styles.tablePreview, { color: D.tablePreview }]}>
                Stolovi: {Array.from({ length: Math.min(parseInt(tableCount), 8) }, (_, i) => i + 1).join(", ")}
                {parseInt(tableCount) > 8 ? ` ... ${tableCount}` : ""}
              </Text>
            )}
          </>
        )}

        {/* Sektori */}
        <Text style={[styles.sectionTitle, { color: D.sectionTitle }]}>{t("adminSettings.sectors")}</Text>
        <Text style={[styles.sectionHint, { color: D.sectionHint }]}>
          {t("adminSettings.sectorsHint")}
        </Text>
        {sectors.map((s, i) => (
          <View key={s.id}>
            <View style={styles.sectorRow}>
              <Pressable
                style={[styles.sectorIconBtn, { backgroundColor: D.sectorIconBtn }]}
                onPress={() => setIconPickerOpen(iconPickerOpen === s.id ? null : s.id)}
              >
                <Ionicons
                  name={(s.icon as keyof typeof Ionicons.glyphMap) || "wine-outline"}
                  size={22}
                  color={primaryColor}
                />
              </Pressable>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
                value={s.name}
                onChangeText={v => updateSector(i, "name", v)}
                placeholder={`${t("adminSettings.sectorPlaceholder") ?? "Station"} ${i + 1}`}
                placeholderTextColor={D.placeholder}
              />
              <Pressable onPress={() => removeSector(i)} style={styles.removeBtn}>
                <Ionicons name="close" size={16} color="#ef4444" />
              </Pressable>
            </View>

            {/* Icon picker */}
            {iconPickerOpen === s.id && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.iconPickerScroll, { backgroundColor: D.iconPickerScroll, borderColor: D.iconPickerBorder }]}
                contentContainerStyle={styles.iconPickerRow}
                keyboardShouldPersistTaps="handled"
              >
                {SECTOR_ICONS.map(ic => (
                  <Pressable
                    key={ic}
                    style={[styles.iconPickerItem, { backgroundColor: D.iconPickerItem, borderColor: D.iconPickerItemBorder }, s.icon === ic && styles.iconPickerItemActive]}
                    onPress={() => {
                      updateSector(i, "icon", ic);
                      setIconPickerOpen(null);
                    }}
                  >
                    <Ionicons
                      name={ic}
                      size={24}
                      color={s.icon === ic ? "#fff" : "#555"}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ))}
        <Pressable onPress={addSector} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{t("adminSettings.addSector")}</Text>
        </Pressable>

        {/* â”€â”€ Boja aplikacije â”€â”€ */}
        <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder, marginTop: 20 }]}>
          <Text style={[styles.cardTitle, { color: D.cardTitle }]}>{t("adminSettings.appColor")}</Text>
          <Text style={[styles.sectionHint, { color: D.sectionHint, marginBottom: 14 }]}>
            {t("adminSettings.appColorHint") ?? "Choose a colour matching your brand. Change is instant."}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {PRESET_COLORS.map(({ hex, label }) => {
              const active = primaryColor === hex;
              return (
                <Pressable
                  key={hex}
                  onPress={async () => {
                    await applyColor(hex);
                  }}
                  style={{ alignItems: "center", gap: 4 }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: hex,
                    borderWidth: active ? 3 : 2,
                    borderColor: active ? (darkMode ? "#fff" : "#111") : "transparent",
                    shadowColor: hex, shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: active ? 0.6 : 0.2, shadowRadius: 4, elevation: active ? 6 : 2,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {active && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </View>
                  <Text style={{ fontSize: 10, color: D.sectionHint, fontWeight: active ? "700" : "400" }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom color picker button */}
          <Pressable
            onPress={() => { setPendingColor(primaryColor); setColorPickerVisible(true); }}
            style={{
              marginTop: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 1.5,
              borderColor: !PRESET_COLORS.some(c => c.hex === primaryColor) ? primaryColor : (darkMode ? "#4B5563" : "#D1D5DB"),
              borderRadius: 12,
              padding: 12,
              backgroundColor: !PRESET_COLORS.some(c => c.hex === primaryColor) ? primaryColor + "15" : "transparent",
            }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: primaryColor }} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: D.infoText }}>
              {t("adminSettings.customColor") ?? "Custom colour"}
            </Text>
            {!PRESET_COLORS.some(c => c.hex === primaryColor) && (
              <Text style={{ fontSize: 12, fontWeight: "700", color: primaryColor }}>
                {primaryColor.toUpperCase()}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={D.sectionHint} />
          </Pressable>
        </View>

        {/* ── Color Picker Modal ── */}
        <Modal
          visible={colorPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setColorPickerVisible(false)}
        >
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
            <View style={{
              backgroundColor: darkMode ? "#1F2937" : "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 36,
              gap: 16,
            }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: darkMode ? "#F9FAFB" : "#18181B", marginBottom: 4 }}>
                {t("adminSettings.selectColor") ?? "Select colour"}
              </Text>
              <ColorPicker
                value={pendingColor}
                onComplete={({ hex }) => setPendingColor(hex)}
                style={{ gap: 12 }}
              >
                <Preview />
                <Panel1 style={{ borderRadius: 12, height: 200 }} />
                <HueSlider style={{ borderRadius: 12, height: 28 }} />
              </ColorPicker>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Pressable
                  onPress={() => setColorPickerVisible(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: darkMode ? "#4B5563" : "#D1D5DB", alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "600", color: darkMode ? "#E5E7EB" : "#555" }}>{t("adminSettings.cancel") ?? "Cancel"}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await applyColor(pendingColor);
                    setColorPickerVisible(false);
                  }}
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: pendingColor, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700", color: "#fff" }}>{t("adminSettings.confirm") ?? "Confirm"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty}
          style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.4 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? t("adminSettings.saving") : t("adminSettings.saveChanges")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  unsavedBanner: {
    backgroundColor: "#fff3cd",
    borderBottomWidth: 1,
    borderBottomColor: "#ffc107",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  unsavedBannerText: { fontSize: 13, color: "#856404", fontWeight: "600" },
  savedBanner: {
    backgroundColor: "#d1fae5",
    borderBottomWidth: 1,
    borderBottomColor: "#34d399",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  savedBannerText: { fontSize: 13, color: "#065f46", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#888", marginBottom: 8, textTransform: "uppercase" },
  infoRow: { fontSize: 15, color: "#333", marginBottom: 4 },
  infoLabel: { fontWeight: "600", color: "#555" },
  joinCode: { fontSize: 20, fontWeight: "800", color: p, letterSpacing: 3 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#222", marginTop: 20, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: "#888", marginBottom: 12 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    gap: 12,
  },
  modeCardActive: { borderColor: p, backgroundColor: "#f0fafb" },
  modeRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#ccc",
    alignItems: "center", justifyContent: "center",
  },
  modeRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p },
  modeLabel: { fontSize: 15, fontWeight: "600", color: "#444" },
  modeLabelActive: { color: p },
  modeDesc: { fontSize: 12, color: "#888", marginTop: 2 },
  zoneCard: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1,
    borderColor: "#e5e5e5", padding: 10, marginBottom: 8,
  },
  zoneCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tableCountBox: {
    alignItems: "center", backgroundColor: "#f0fafb",
    borderRadius: 8, borderWidth: 1, borderColor: "#b2dfdf", paddingHorizontal: 8, paddingVertical: 4,
  },
  tableCountLabel: { fontSize: 10, color: p, fontWeight: "600", marginBottom: 2 },
  tableCountInput: { fontSize: 16, fontWeight: "700", color: p, width: 48, textAlign: "center" },
  sectorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectorIconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#e8f8f9", borderWidth: 1.5, borderColor: p,
    alignItems: "center", justifyContent: "center",
  },
  iconPickerScroll: {
    backgroundColor: "#f0fafb", borderRadius: 10,
    borderWidth: 1, borderColor: "#b2dfdf", marginBottom: 8,
  },
  iconPickerRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  iconPickerItem: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: "#ddd",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  iconPickerItemActive: { backgroundColor: p, borderColor: p },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: "#fff", marginBottom: 4,
  },
  removeBtn: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10 },
  removeBtnText: { color: "#c0392b", fontWeight: "700" },
  addBtn: { paddingVertical: 8 },
  addBtnText: { color: p, fontWeight: "600", fontSize: 14 },
  tablePreview: { fontSize: 12, color: "#888", marginBottom: 4 },
  saveBtn: {
    backgroundColor: p, borderRadius: 12,
    padding: 16, alignItems: "center", marginTop: 28,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
