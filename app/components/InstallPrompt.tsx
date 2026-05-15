import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export default function InstallPrompt() {
  const { primaryColor } = useTheme();
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [step, setStep] = useState<"main" | "ios-guide">("main");
  const deferredPrompt = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (isStandalone()) return;
    if (!isMobile()) return; // Na desktopu ne prikazuj prompt
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) return; // Ne prikazuj u dev modu

    const ios = isIOS();
    setIsIos(ios);
    setVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    if (!ios) {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPrompt.current = e;
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") setVisible(false);
    }
  };

  const handleShare = async () => {
    try { await navigator.share({ title: "Ordea", url: window.location.href }); } catch {}
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={[styles.bg, { backgroundColor: primaryColor }]} />
      <View style={styles.bgDark} />

      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/images/icon.png")} style={styles.logo} />
        </View>
        <Text style={styles.appName}>Ordea</Text>
        <Text style={styles.tagline}>Sistem narudžbi za ugostiteljstvo</Text>
        <View style={styles.divider} />

        {step === "main" ? (
          <>
            <Text style={styles.heading}>Instaliraj aplikaciju</Text>
            <Text style={styles.desc}>
              Ordea radi kao nativna aplikacija — brže, pouzdanije i bez browser adresne trake.
              Instaliraj na početni ekran da nastaviš.
            </Text>
            <View style={styles.benefits}>
              {[
                { icon: "flash-outline", text: "Brže pokretanje" },
                { icon: "wifi-outline", text: "Radi i offline" },
                { icon: "notifications-outline", text: "Push notifikacije" },
              ].map(b => (
                <View key={b.icon} style={styles.benefitRow}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name={b.icon as any} size={18} color="#fff" />
                  </View>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>
            {isIos ? (
              <Pressable onPress={() => setStep("ios-guide")} style={styles.btn}>
                <Ionicons name="phone-portrait-outline" size={20} color={primaryColor} />
                <Text style={[styles.btnText, { color: primaryColor }]}>Pokaži kako instalirati</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleInstall} style={styles.btn}>
                <Ionicons name="download-outline" size={20} color={primaryColor} />
                <Text style={[styles.btnText, { color: primaryColor }]}>Instaliraj aplikaciju</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={styles.heading}>Dodaj na početni ekran</Text>
            <Text style={styles.desc}>Slijedi ova 3 koraka u Safari browseru:</Text>
            <View style={styles.steps}>
              {[
                { n: "1", icon: "share-outline", text: "Tapni dugme \"Dijeli\" u donjem dijelu ekrana" },
                { n: "2", icon: "add-circle-outline", text: "Odaberi \"Dodaj na početni ekran\"" },
                { n: "3", icon: "checkmark-circle-outline", text: "Tapni \"Dodaj\" u gornjem desnom uglu" },
              ].map(s => (
                <View key={s.n} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{s.n}</Text>
                  </View>
                  <Ionicons name={s.icon as any} size={22} color="rgba(255,255,255,0.8)" style={{ marginRight: 10 }} />
                  <Text style={styles.stepText}>{s.text}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={handleShare} style={styles.btn}>
              <Ionicons name="share-outline" size={20} color={primaryColor} />
              <Text style={[styles.btnText, { color: primaryColor }]}>Otvori meni dijeljenja</Text>
            </Pressable>
            <Pressable onPress={() => setStep("main")} style={styles.backBtn}>
              <Ionicons name="arrow-back-outline" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.backText}>Nazad</Text>
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99999,
    alignItems: "center",
    justifyContent: "center",
  },
  bg: { ...StyleSheet.absoluteFillObject },
  bgDark: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  content: {
    width: "100%",
    maxWidth: 400,
    paddingHorizontal: 32,
    paddingVertical: 40,
    alignItems: "center",
  },
  logoWrap: {
    width: 96, height: 96, borderRadius: 22, overflow: "hidden", marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  logo: { width: 96, height: 96 },
  appName: { fontSize: 32, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: 4, textAlign: "center" },
  divider: { width: 40, height: 2, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, marginVertical: 28 },
  heading: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 12, textAlign: "center" },
  desc: { fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  benefits: { width: "100%", gap: 12, marginBottom: 32 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  benefitText: { fontSize: 15, color: "rgba(255,255,255,0.9)", fontWeight: "500" },
  btn: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 14, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  steps: { width: "100%", gap: 16, marginBottom: 32 },
  stepRow: { flexDirection: "row", alignItems: "center" },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 10, backgroundColor: "rgba(255,255,255,0.2)" },
  stepNumText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, padding: 8 },
  backText: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
});
