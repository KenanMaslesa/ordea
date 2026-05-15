import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const DISMISSED_KEY = "ordea_install_dismissed";
const DISMISS_DAYS = 1; // ponovo pitaj nakon 1 dan

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const val = localStorage.getItem(DISMISSED_KEY);
    if (!val) return false;
    const ts = parseInt(val, 10);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const { primaryColor, darkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const deferredPrompt = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;

    const ios = isIOS();
    setIsIos(ios);

    if (ios) {
      // Na iOS nema beforeinstallprompt — odmah pokaži upute
      setTimeout(() => show(), 2000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setTimeout(() => show(), 1500);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const show = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setVisible(false));
    try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()); } catch {}
  };

  const install = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") {
        dismiss();
        return;
      }
    }
    dismiss();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: darkMode ? "#1F2937" : "#fff", transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: primaryColor }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, { color: darkMode ? "#F9FAFB" : "#111827" }]}>
          Dodaj Ordea na početni ekran
        </Text>
        <Text style={[styles.desc, { color: darkMode ? "#9CA3AF" : "#6B7280" }]}>
          {isIos ? "Tapni Dijeli pa \"Dodaj na početni ekran\"" : "Radi kao app — brže, bez browsera"}
        </Text>
      </View>
      <View style={styles.actions}>
        {isIos ? (
          <Pressable
            onPress={async () => {
              try { await navigator.share({ title: "Ordea", url: window.location.href }); } catch {}
            }}
            style={[styles.installBtn, { backgroundColor: primaryColor }]}
          >
            <Ionicons name="share-outline" size={14} color="#fff" />
            <Text style={styles.installText}>Dijeli</Text>
          </Pressable>
        ) : (
          <Pressable onPress={install} style={[styles.installBtn, { backgroundColor: primaryColor }]}>
            <Text style={styles.installText}>Instaliraj</Text>
          </Pressable>
        )}
        <Pressable onPress={dismiss} hitSlop={10}>
          <Ionicons name="close" size={20} color={darkMode ? "#6B7280" : "#9CA3AF"} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 9999,
  },
  accent: {
    width: 4,
    height: 44,
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  installBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  installText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
