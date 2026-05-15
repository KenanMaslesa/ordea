import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./context/ThemeContext";
import { getItem, setItem } from "./helper";

const TEAL = "#0E7C86";
type Theme = "teal" | "white";

export default function WaiterSettings() {
  const router = useRouter();
  const [headerTheme, setHeaderTheme] = useState<Theme>("white");
  const [sheetTheme, setSheetTheme] = useState<Theme>("white");
  const { darkMode, setDarkMode: toggleDarkMode } = useTheme();

  useEffect(() => {
    (async () => {
      const h = await getItem("@waiterHeaderTheme");
      const s = await getItem("@waiterSheetTheme");
      if (h === "teal" || h === "white") setHeaderTheme(h);
      if (s === "teal" || s === "white") setSheetTheme(s);
    })();
  }, []);

  const saveHeaderTheme = async (val: Theme) => {
    setHeaderTheme(val);
    await setItem("@waiterHeaderTheme", val);
  };

  const saveSheetTheme = async (val: Theme) => {
    setSheetTheme(val);
    await setItem("@waiterSheetTheme", val);
  };

  const dark = darkMode;
  const D = dark ? {
    root: "#111827",
    header: "#1F2937",
    card: "#1F2937",
    border: "#374151",
    title: "#F9FAFB",
    label: "#9CA3AF",
    rowLabel: "#E5E7EB",
    segBg: "#374151",
  } : {
    root: "#F4F4F5",
    header: "#fff",
    card: "#fff",
    border: "#E4E4E7",
    title: "#18181B",
    label: "#71717A",
    rowLabel: "#18181B",
    segBg: "#F4F4F5",
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: D.root }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: D.header, borderColor: D.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={TEAL} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: D.title }]}>Postavke</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: D.label }]}>TEMA</Text>
        <View style={[styles.card, { backgroundColor: D.card, borderColor: D.border }]}>
          <SegmentRow
            label="Dark mode"
            labelColor={D.rowLabel}
            segBg={D.segBg}
            value={darkMode ? "on" : "off"}
            onChange={(val: string) => toggleDarkMode(val === "on")}
            options={[
              { label: "Uključen", value: "on" },
              { label: "Isključen", value: "off" },
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: D.label }]}>IZGLED ZAGLAVLJA</Text>
        <View style={[styles.card, { backgroundColor: D.card, borderColor: D.border }]}>
          <SegmentRow
            label="Stil zaglavlja"
            labelColor={D.rowLabel}
            segBg={D.segBg}
            value={headerTheme}
            onChange={saveHeaderTheme}
            options={[
              { label: "Teal", value: "teal" },
              { label: "Bijelo", value: "white" },
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: D.label }]}>IZGLED NARUDŽBE</Text>
        <View style={[styles.card, { backgroundColor: D.card, borderColor: D.border }]}>
          <SegmentRow
            label="Donji panel"
            labelColor={D.rowLabel}
            segBg={D.segBg}
            value={sheetTheme}
            onChange={saveSheetTheme}
            options={[
              { label: "Teal", value: "teal" },
              { label: "Bijelo", value: "white" },
            ]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SegmentRow({
  label,
  labelColor,
  segBg,
  value,
  options,
  onChange,
}: {
  label: string;
  labelColor: string;
  segBg: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: any) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.segment, { backgroundColor: segBg }]}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.segBtn, value === opt.value && styles.segBtnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segBtnText, value === opt.value && styles.segBtnTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  section: { marginTop: 28, paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
  },
  segBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segBtnActive: { backgroundColor: TEAL },
  segBtnText: { fontSize: 13, fontWeight: "600", color: "#71717A" },
  segBtnTextActive: { color: "#fff" },
});
