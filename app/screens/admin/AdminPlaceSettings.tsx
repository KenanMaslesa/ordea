import { db, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { LocationMode, Place, Sector, Zone } from "../../types/order.types";

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
}

const MODE_OPTIONS: { value: LocationMode; label: string; desc: string }[] = [
  { value: "none", label: "Ništa", desc: "Konobar ne bira lokaciju" },
  { value: "zones", label: "Samo zone", desc: "Konobar bira zonu (Sala, Terasa...)" },
  { value: "tables", label: "Samo stolovi", desc: "Konobar bira broj stola" },
  { value: "zones_tables", label: "Zone + stolovi", desc: "Konobar bira zonu pa sto" },
];

export default function AdminPlaceSettings({ placeId }: Props) {
  const [place, setPlace] = useState<Place | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("zones");
  const [zones, setZones] = useState<Zone[]>([]);
  const [tableCount, setTableCount] = useState("0");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState<string | null>(null);
  const savedOpacity = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      Alert.alert("Greška", "Nije moguće sačuvati postavke.");
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      {/* Unsaved changes banner */}
      {dirty && (
        <View style={styles.unsavedBanner}>
          <Text style={styles.unsavedBannerText}>⚠️ Imate nespremljene promjene</Text>
        </View>
      )}

      {/* Success banner */}
      {savedMsg && (
        <Animated.View style={[styles.savedBanner, { opacity: savedOpacity }]}>
          <Text style={styles.savedBannerText}>✓ Postavke su uspješno snimljene</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Osnovne informacije */}
        {place && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Objekat</Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Naziv: </Text>{place.name}
            </Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Join kod: </Text>
              <Text style={styles.joinCode}>{place.joinCode}</Text>
            </Text>
          </View>
        )}

        {/* Mod lokacije */}
        <Text style={styles.sectionTitle}>Izbor lokacije</Text>
        <Text style={styles.sectionHint}>
          Određuje šta konobar bira prije slanja narudžbe.
        </Text>

        {MODE_OPTIONS.map(opt => (
          <Pressable
            key={opt.value}
            onPress={() => { setLocationMode(opt.value); setDirty(true); }}
            style={[styles.modeCard, locationMode === opt.value && styles.modeCardActive]}
          >
            <View style={styles.modeRadio}>
              {locationMode === opt.value && <View style={styles.modeRadioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeLabel, locationMode === opt.value && styles.modeLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.modeDesc}>{opt.desc}</Text>
            </View>
          </Pressable>
        ))}

        {/* Zone */}
        {showZones && (
          <>
            <Text style={styles.sectionTitle}>
              {showPerZoneTables ? "Zone i stolovi" : "Zone"}
            </Text>
            {showPerZoneTables && (
              <Text style={styles.sectionHint}>Unesite naziv zone i broj stolova u toj zoni.</Text>
            )}
            {zones.map((z, i) => (
              <View key={i} style={styles.zoneCard}>
                <View style={styles.zoneCardRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={z.name}
                    onChangeText={v => updateZone(i, "name", v)}
                    placeholder={`Zona ${i + 1} (npr. Sala, Terasa)`}
                  />
                  {showPerZoneTables && (
                    <View style={styles.tableCountBox}>
                      <Text style={styles.tableCountLabel}>Stolovi</Text>
                      <TextInput
                        style={styles.tableCountInput}
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
                  <Text style={styles.tablePreview}>
                    Stolovi: {Array.from({ length: Math.min(z.tableCount, 6) }, (_, k) => k + 1).join(", ")}
                    {z.tableCount > 6 ? ` ... ${z.tableCount}` : ""}
                  </Text>
                )}
              </View>
            ))}
            <Pressable onPress={addZone} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Dodaj zonu</Text>
            </Pressable>
          </>
        )}

        {/* Globalni stolovi (samo "tables" mod) */}
        {showGlobalTables && (
          <>
            <Text style={styles.sectionTitle}>Broj stolova</Text>
            <TextInput
              style={styles.input}
              value={tableCount}
              onChangeText={v => { setTableCount(v); setDirty(true); }}
              keyboardType="number-pad"
              placeholder="npr. 20"
            />
            {parseInt(tableCount) > 0 && (
              <Text style={styles.tablePreview}>
                Stolovi: {Array.from({ length: Math.min(parseInt(tableCount), 8) }, (_, i) => i + 1).join(", ")}
                {parseInt(tableCount) > 8 ? ` ... ${tableCount}` : ""}
              </Text>
            )}
          </>
        )}

        {/* Sektori */}
        <Text style={styles.sectionTitle}>Sektori</Text>
        <Text style={styles.sectionHint}>
          Definiraju gdje ide svaka stavka menija (Šank, Kuhinja...). Osoblje bira sektor pri prijavi.
        </Text>
        {sectors.map((s, i) => (
          <View key={s.id}>
            <View style={styles.sectorRow}>
              <Pressable
                style={styles.sectorIconBtn}
                onPress={() => setIconPickerOpen(iconPickerOpen === s.id ? null : s.id)}
              >
                <Ionicons
                  name={(s.icon as keyof typeof Ionicons.glyphMap) || "wine-outline"}
                  size={22}
                  color="#0E7C86"
                />
              </Pressable>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={s.name}
                onChangeText={v => updateSector(i, "name", v)}
                placeholder={`Sektor ${i + 1} (npr. Šank, Kuhinja)`}
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
                style={styles.iconPickerScroll}
                contentContainerStyle={styles.iconPickerRow}
                keyboardShouldPersistTaps="handled"
              >
                {SECTOR_ICONS.map(ic => (
                  <Pressable
                    key={ic}
                    style={[styles.iconPickerItem, s.icon === ic && styles.iconPickerItemActive]}
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
          <Text style={styles.addBtnText}>+ Dodaj sektor</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty}
          style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.4 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? "Čuvanje..." : "Sačuvaj sve postavke"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  joinCode: { fontSize: 20, fontWeight: "800", color: "#0E7C86", letterSpacing: 3 },
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
  modeCardActive: { borderColor: "#0E7C86", backgroundColor: "#f0fafb" },
  modeRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#ccc",
    alignItems: "center", justifyContent: "center",
  },
  modeRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0E7C86" },
  modeLabel: { fontSize: 15, fontWeight: "600", color: "#444" },
  modeLabelActive: { color: "#0E7C86" },
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
  tableCountLabel: { fontSize: 10, color: "#0E7C86", fontWeight: "600", marginBottom: 2 },
  tableCountInput: { fontSize: 16, fontWeight: "700", color: "#0E7C86", width: 48, textAlign: "center" },
  sectorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectorIconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#e8f8f9", borderWidth: 1.5, borderColor: "#0E7C86",
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
  iconPickerItemActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: "#fff", marginBottom: 4,
  },
  removeBtn: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10 },
  removeBtnText: { color: "#c0392b", fontWeight: "700" },
  addBtn: { paddingVertical: 8 },
  addBtnText: { color: "#0E7C86", fontWeight: "600", fontSize: 14 },
  tablePreview: { fontSize: 12, color: "#888", marginBottom: 4 },
  saveBtn: {
    backgroundColor: "#0E7C86", borderRadius: 12,
    padding: 16, alignItems: "center", marginTop: 28,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
