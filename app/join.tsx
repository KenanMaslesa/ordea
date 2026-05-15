import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useTheme } from "./context/ThemeContext";
import { getItem, setItem } from "./helper";
import { getPlaceByJoinCode } from "./services/place.service";
import { Place, Sector } from "./types/order.types";

type Step = "code" | "role" | "name";

export default function JoinScreen() {
  const router = useRouter();
  const { darkMode, primaryColor } = useTheme();

  const D = darkMode ? {
    wrapper: "#111827",
    subtitle: "#9CA3AF",
    codeInput: "#1F2937",
    codeInputBorder: primaryColor,
    codeInputText: "#E5E7EB",
    input: "#1F2937",
    inputBorder: "#374151",
    inputText: "#E5E7EB",
    placeholder: "#6B7280",
    roleBtn: "#1F2937",
    roleBtnBorder: "#374151",
    roleName: "#F9FAFB",
    roleDesc: "#9CA3AF",
    dividerLine: "#374151",
    dividerText: "#6B7280",
    noSectorsBox: "#1C1400",
    noSectorsBoxBorder: "#78350F",
    noSectorsText: "#FCD34D",
    adminLinkText: "#6B7280",
    backText: "#22D3EE",
  } : {
    wrapper: "#F4F5F7",
    subtitle: "#666",
    codeInput: "#fff",
    codeInputBorder: primaryColor,
    codeInputText: "#18181B",
    input: "#fff",
    inputBorder: "#ddd",
    inputText: "#18181B",
    placeholder: "#A1A1AA",
    roleBtn: "#fff",
    roleBtnBorder: "#e0e0e0",
    roleName: "#1a1a1a",
    roleDesc: "#888",
    dividerLine: "#ddd",
    dividerText: "#aaa",
    noSectorsBox: "#fff8e1",
    noSectorsBoxBorder: "#ffe082",
    noSectorsText: "#7a5c00",
    adminLinkText: "#999",
    backText: primaryColor,
  };

  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);

  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("code");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeSectors, setPlaceSectors] = useState<Sector[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);

  // Auto-submit if code comes from deep link / shared URL
  useEffect(() => {
    if (params.code && params.code.length >= 4) {
      setCode(params.code.toUpperCase());
      autoSubmitCode(params.code.toUpperCase());
    }
  }, []);

  const autoSubmitCode = async (autoCode: string) => {
    setLoading(true);
    try {
      const place = await getPlaceByJoinCode(autoCode.trim());
      if (!place) {
        return Alert.alert("Greška", "Kod nije pronađen. Provjerite link i pokušajte ponovo.");
      }
      setPlaceId(place.id);
      setPlaceName(place.name);
      setPlaceSectors((place as Place).sectors ?? []);
      setSelectedSectorIds([]);
      setStep("role");
    } catch {
      Alert.alert("Greška", "Problem s povezivanjem. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (code.trim().length < 4) {
      return Alert.alert("Greška", "Unesite ispravan kod.");
    }
    setLoading(true);
    try {
      const place = await getPlaceByJoinCode(code.trim());
      if (!place) {
        return Alert.alert("Greška", "Kod nije pronađen. Provjerite i pokušajte ponovo.");
      }
      setPlaceId(place.id);
      setPlaceName(place.name);
      setPlaceSectors((place as Place).sectors ?? []);
      setSelectedSectorIds([]);
      setStep("role");
    } catch {
      Alert.alert("Greška", "Problem s povezivanjem. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSector = (id: string) => {
    setSelectedSectorIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleFinishBartender = async () => {
    if (selectedSectorIds.length === 0) return;
    setLoading(true);
    try {
      const existingDeviceId = await getItem("@deviceId");
      const deviceId = existingDeviceId || (
        Device.modelName
          ? `${Device.modelName}_${Math.random().toString(36).slice(2, 8)}`
          : Math.random().toString(36).slice(2, 10)
      );
      await setItem("@placeId", placeId);
      await setItem("@role", "bartender");
      await setItem("@deviceId", deviceId);
      await setItem("@sectorIds", JSON.stringify(selectedSectorIds));
      router.replace("/bartender");
    } catch {
      Alert.alert("Greška", "Problem s čuvanjem podataka.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishWaiter = async () => {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Greška", "Unesite vaše ime.");
    setLoading(true);
    try {
      const existingDeviceId = await getItem("@deviceId");
      const deviceId = existingDeviceId || (
        Device.modelName
          ? `${Device.modelName}_${Math.random().toString(36).slice(2, 8)}`
          : Math.random().toString(36).slice(2, 10)
      );
      await setItem("@placeId", placeId);
      await setItem("@role", "waiter");
      await setItem("@deviceId", deviceId);
      await setItem("@waiterName", trimmed);
      router.replace("/waiter");
    } catch {
      Alert.alert("Greška", "Problem s čuvanjem podataka.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.wrapper, { backgroundColor: D.wrapper }]}
    >
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: D.wrapper }]} keyboardShouldPersistTaps="handled">

        {/* STEP 1 — Join code */}
        {step === "code" && (
          <>
            <Text style={styles.title}>Pridruži se</Text>
            <Text style={[styles.subtitle, { color: D.subtitle }]}>
              Unesite kod koji vam je dao administrator objekta.
            </Text>
            <TextInput
              style={[styles.codeInput, { backgroundColor: D.codeInput, borderColor: D.codeInputBorder, color: D.codeInputText }]}
              placeholder="npr. AB3X7K"
              placeholderTextColor={D.placeholder}
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
              autoFocus
            />
            <Pressable
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleCodeSubmit}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "Provjera..." : "Nastavi"}</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/login")} style={styles.adminLink}>
              <Text style={[styles.adminLinkText, { color: D.adminLinkText }]}>Admin prijava →</Text>
            </Pressable>
          </>
        )}

        {/* STEP 2 — Role + sector selection */}
        {step === "role" && (
          <>
            <Text style={styles.title}>{placeName}</Text>
            <Text style={[styles.subtitle, { color: D.subtitle }]}>Ko ste?</Text>

            {/* Konobar — always available */}
            <Pressable style={[styles.roleBtn, { backgroundColor: D.roleBtn, borderColor: D.roleBtnBorder }]} onPress={() => setStep("name")}>
              <Text style={styles.roleIcon}>🙋</Text>
              <Text style={[styles.roleName, { color: D.roleName }]}>Konobar</Text>
              <Text style={[styles.roleDesc, { color: D.roleDesc }]}>Kreiram narudžbe za stolove</Text>
            </Pressable>

            {/* Sectors — multi-select */}
            {placeSectors.length > 0 ? (
              <>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: D.dividerLine }]} />
                  <Text style={[styles.dividerText, { color: D.dividerText }]}>ili — osoblje stanica</Text>
                  <View style={[styles.dividerLine, { backgroundColor: D.dividerLine }]} />
                </View>

                {placeSectors.map(s => {
                  const active = selectedSectorIds.includes(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      style={[styles.roleBtn, { backgroundColor: D.roleBtn, borderColor: D.roleBtnBorder }, active && styles.roleBtnActive]}
                      onPress={() => toggleSector(s.id)}
                    >
                    <Ionicons
                        name={(s.icon as keyof typeof Ionicons.glyphMap) || "wine-outline"}
                        size={32}
                        color={active ? "#fff" : primaryColor}
                        style={{ marginBottom: 6 }}
                      />
                      <Text style={[styles.roleName, { color: D.roleName }, active && { color: "#fff" }]}>{s.name}</Text>
                      <Text style={[styles.roleDesc, { color: D.roleDesc }, active && { color: "#c8f0f3" }]}>
                        {active ? "✓ Odabrano" : "Tap za odabir"}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  style={[styles.btn, { marginTop: 8 }, (selectedSectorIds.length === 0 || loading) && { opacity: 0.4 }]}
                  onPress={handleFinishBartender}
                  disabled={selectedSectorIds.length === 0 || loading}
                >
                  <Text style={styles.btnText}>
                    {loading ? "..." : `Počni raditi (${selectedSectorIds.length > 0 ? selectedSectorIds.map(id => placeSectors.find(s => s.id === id)?.name).join(" + ") : "odaberi sektor"})`}
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={[styles.noSectorsBox, { backgroundColor: D.noSectorsBox, borderColor: D.noSectorsBoxBorder }]}>
                <Text style={[styles.noSectorsText, { color: D.noSectorsText }]}>
                  ℹ️ Admin još nije postavio sektore.{"\n"}Ako radite na šanku ili kuhinji, kontaktirajte administratora.
                </Text>
              </View>
            )}

            <Pressable onPress={() => setStep("code")} style={styles.backBtn}>
              <Text style={[styles.backText, { color: D.backText }]}>← Nazad</Text>
            </Pressable>
          </>
        )}

        {/* STEP 3 — Waiter name */}
        {step === "name" && (
          <>
            <Text style={styles.title}>Vaše ime</Text>
            <Text style={[styles.subtitle, { color: D.subtitle }]}>Ovo ime će se prikazivati na narudžbama.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
              placeholder="npr. Amina"
              placeholderTextColor={D.placeholder}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Pressable
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleFinishWaiter}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "..." : "Počni raditi"}</Text>
            </Pressable>
            <Pressable onPress={() => setStep("role")} style={styles.backBtn}>
              <Text style={[styles.backText, { color: D.backText }]}>← Nazad</Text>
            </Pressable>
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F4F5F7" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 28,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: p,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  codeInput: {
    borderWidth: 2,
    borderColor: p,
    borderRadius: 12,
    padding: 16,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  btn: {
    backgroundColor: p,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  roleBtn: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  roleBtnActive: { backgroundColor: p, borderColor: p },
  roleIcon: { fontSize: 36, marginBottom: 6 },
  roleName: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  roleDesc: { fontSize: 13, color: "#888", marginTop: 2 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#ddd" },
  dividerText: { fontSize: 12, color: "#aaa", flexShrink: 0 },
  noSectorsBox: {
    backgroundColor: "#fff8e1",
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ffe082",
  },
  noSectorsText: { fontSize: 13, color: "#7a5c00", lineHeight: 20, textAlign: "center" },
  backBtn: { marginTop: 20, alignItems: "center" },
  backText: { color: p, fontSize: 14 },
  adminLink: { marginTop: 32, alignItems: "center" },
  adminLinkText: { color: "#999", fontSize: 13 },
});

type Role = "waiter" | "bartender";
