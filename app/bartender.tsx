import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db, placesRoot } from "../firebase";
import SideDrawer from "./components/SideDrawer";
import { useTheme } from "./context/ThemeContext";
import { getItem, setItem } from "./helper";
import useAuth from "./hooks/useAuth";
import BartenderHistoryScreen from "./screens/BartenderHistoryScreen";
import OrderCard from "./screens/components/OrderCard";
import { listenOrders, markSectorDone } from "./services/orders.service";
import { Order, Sector } from "./types/order.types";
import { AppTheme } from "./types/theme.types";

/* ---------------- THEME ---------------- */

const DARK: AppTheme = {
  bg: "#0D0D0F",
  surface: "#18181B",
  surfaceHigh: "#27272A",
  border: "#3F3F46",
  primary: "#0E7C86",
  accent: "#22C55E",
  accentDim: "#16A34A",
  danger: "#EF4444",
  dangerDim: "#B91C1C",
  warn: "#F59E0B",
  text: "#FAFAFA",
  textSub: "#A1A1AA",
  textMuted: "#71717A",
  white: "#FFFFFF",
  itemNoteBg: "#2D2000",
  itemNoteBorder: "#78350F",
  orderNoteBg: "#0C1F3A",
  orderNoteBorder: "#1E3A5F",
  orderNoteText: "#93C5FD",
  modalIconBg: "#052E16",
  modalIconBorder: "#166534",
  cardAlertBg: "#1C0A0A",
};

const LIGHT: AppTheme = {
  bg: "#F4F4F5",
  surface: "#FFFFFF",
  surfaceHigh: "#F1F5F9",
  border: "#E4E4E7",
  primary: "#0E7C86",
  accent: "#16A34A",
  accentDim: "#15803D",
  danger: "#DC2626",
  dangerDim: "#B91C1C",
  warn: "#D97706",
  text: "#09090B",
  textSub: "#52525B",
  textMuted: "#A1A1AA",
  white: "#FFFFFF",
  itemNoteBg: "#FFFBEB",
  itemNoteBorder: "#FCD34D",
  orderNoteBg: "#EFF6FF",
  orderNoteBorder: "#BFDBFE",
  orderNoteText: "#1D4ED8",
  modalIconBg: "#DCFCE7",
  modalIconBorder: "#86EFAC",
  cardAlertBg: "#FEF2F2",
};

/* ---------------- TIME ---------------- */

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let r = "";
  if (h > 0) r += `${h}h `;
  if (m > 0 || h > 0) r += `${m}m `;
  r += `${s}s`;
  return r.trim();
};

const urgencyColor = (seconds: number, C: typeof DARK) => {
  if (seconds > 900) return C.danger;  // >15 min — crvena
  if (seconds > 420) return C.warn;    // >7 min — žuta
  return C.accent;                     // ok — zelena
};

/* ================= SCREEN ================= */

export default function Bartender() {
  useAuth("bartender");

  const router = useRouter();
  const { darkMode, setDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [timeNow, setTimeNow] = useState(Date.now());
  const [blinking, setBlinking] = useState<string[]>([]);
  const [showAudioModal, setShowAudioModal] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [mySectorIds, setMySectorIds] = useState<string[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [pendingOfflineDoneCount, setPendingOfflineDoneCount] = useState(0);
  const [reconnectedCount, setReconnectedCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const pendingOfflineDoneRef = useRef(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  const C = darkMode ? DARK : LIGHT;

  /* ---------- LOAD STORAGE ---------- */

  useEffect(() => {
    Promise.all([getItem("@placeId"), getItem("@sectorIds"), getItem("@role")]).then(
      ([pid, sids, role]) => {
        setPlaceId(pid);
        setMySectorIds(sids ? JSON.parse(sids) : []);
        if (role === "admin") setIsAdminPreview(true);
      }
    );
  }, []);

  /* ---------- LOAD SECTORS ---------- */

  useEffect(() => {
    if (!placeId) return;
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), d => {
      if (d.exists()) setSectors((d.data().sectors as Sector[]) ?? []);
    });
    return unsub;
  }, [placeId]);

  /* ---------- CONNECTION ---------- */

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      if (!connected) {
        wasOfflineRef.current = true;
      } else if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        const count = pendingOfflineDoneRef.current;
        pendingOfflineDoneRef.current = 0;
        setPendingOfflineDoneCount(0);
        setReconnectedCount(count);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 3000);
      }
    });
    return unsub;
  }, []);

  /* ---------- TIMER ---------- */

  useEffect(() => {
    const i = setInterval(() => setTimeNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  /* ---------- AUDIO ---------- */

  useEffect(() => {
    (async () => {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/notification2.mp3"),
        { volume: 1 }
      );
      soundRef.current = sound;
    })();
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const unlockAudio = async () => {
    setAudioUnlocked(true);
    setShowAudioModal(false);
    await soundRef.current?.playAsync();
    await soundRef.current?.stopAsync();
  };

  const triggerAlarm = useCallback(
    async (id: string) => {
      if (!audioUnlocked || !soundRef.current) return;
      await soundRef.current.replayAsync();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setBlinking(p => [...p, id]);
      setTimeout(() => setBlinking(p => p.filter(x => x !== id)), 2000);
    },
    [audioUnlocked]
  );

  /* ---------- ORDERS LISTENER ---------- */

  useEffect(() => {
    if (!placeId) return;
    return listenOrders(placeId, (allOrders, changes) => {
      setOrders(allOrders);
      changes.forEach(c => {
        if (c.type === "added" && c.order.status === "pending") {
          const relevant =
            mySectorIds.length === 0 ||
            c.order.items.some(i => mySectorIds.includes(i.sectorId ?? ""));
          if (relevant) triggerAlarm(c.order.id);
        }
      });
    });
  }, [placeId, mySectorIds, triggerAlarm]);

  /* ---------- MARK DONE ---------- */

  const handleMarkDone = async (order: Order) => {
    if (!placeId) return;
    const relevantSectors = mySectorIds.filter(sid =>
      order.items.some(i => i.sectorId === sid)
    );
    if (!isConnected) {
      // Fire-and-forget — Firestore buffers the update and sends when online
      let optimisticStatus = { ...(order.sectorStatus ?? {}) };
      for (const sid of relevantSectors) {
        markSectorDone(placeId, order, sid, optimisticStatus).catch(console.error);
        optimisticStatus = { ...optimisticStatus, [sid]: "done" };
      }
      pendingOfflineDoneRef.current += 1;
      setPendingOfflineDoneCount(c => c + 1);
      return;
    }
    let optimisticStatus = { ...(order.sectorStatus ?? {}) };
    for (const sid of relevantSectors) {
      await markSectorDone(placeId, order, sid, optimisticStatus);
      optimisticStatus = { ...optimisticStatus, [sid]: "done" };
    }
  };

  /* ---------- FILTERING ---------- */

  const mySectors = sectors.filter(s => mySectorIds.includes(s.id));

  const visibleOrders = orders
    .filter(o => {
      if (o.status === "cancelled") return false;
      if (mySectorIds.length === 0) return o.status === "pending";
      const hasMyItems = o.items.some(i => mySectorIds.includes(i.sectorId ?? ""));
      const relevantSectors = mySectorIds.filter(sid => o.items.some(i => i.sectorId === sid));
      const myDone = relevantSectors.every(sid => o.sectorStatus?.[sid] === "done");
      return hasMyItems && !myDone;
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  /* ================= UI ================= */

  const styles = useMemo(() => makeStyles(C), [C]);

  const headerLabel = mySectors.length > 0
    ? mySectors.map(s => s.name).join(" + ")
    : "ŠANK";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => setDrawerOpen(true)} hitSlop={12}>
            <Ionicons name="menu" size={24} color={C.textSub} />
          </Pressable>
          {isAdminPreview && (
            <Pressable
              onPress={() => router.replace("/admin")}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={22} color={C.textMuted} />
            </Pressable>
          )}
          <Text style={styles.title}>{headerLabel}</Text>
          <View style={[styles.connDot, { backgroundColor: isConnected ? C.accent : C.danger }]} />
        </View>
        <Pressable onPress={() => setDarkMode(!darkMode)} style={styles.themeToggle} hitSlop={10}>
          <Ionicons
            name={darkMode ? "sunny-outline" : "moon-outline"}
            size={22}
            color={C.textSub}
          />
        </Pressable>
        <Pressable onPress={() => setShowHistory(true)} style={styles.themeToggle} hitSlop={10}>
          <Ionicons name="time-outline" size={22} color={C.textSub} />
        </Pressable>
        <View style={styles.countBadge}>
          <Text style={styles.countNum}>{visibleOrders.length}</Text>
          <Text style={styles.countLabel}>aktivnih</Text>
        </View>
      </View>

      {/* ── OFFLINE BANNER ── */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Ionicons name="wifi-outline" size={15} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            {pendingOfflineDoneCount > 0
              ? `Bez konekcije — ${pendingOfflineDoneCount} narudžba čeka na završavanje`
              : "Bez konekcije — podaci mogu biti zastarjeli"}
          </Text>
        </View>
      )}

      {/* ── BACK ONLINE BANNER ── */}
      {justReconnected && (
        <View style={[styles.offlineBanner, { backgroundColor: "#16a34a" }]}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            {reconnectedCount > 0
              ? `Ponovo online — ${reconnectedCount} narudžba uspješno označeno kao završeno ✓`
              : "Ponovo online ✓"}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {visibleOrders.map((o, idx) => {
          const elapsed = Math.floor((timeNow - o.createdAt) / 1000);
          const timerColor = urgencyColor(elapsed, C);
          return (
            <OrderCard
              key={o.id}
              order={o}
              index={idx}
              C={C}
              sectors={sectors}
              mySectorIds={mySectorIds}
              timerIcon="time-outline"
              timerColor={timerColor}
              timerLabel={formatTime(elapsed)}
              blink={blinking.includes(o.id)}
              onMarkDone={() => handleMarkDone(o)}
            />
          );
        })}

        {visibleOrders.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={56} color={C.border} />
            <Text style={styles.emptyTitle}>Sve je gotovo</Text>
            <Text style={styles.emptySub}>Nema aktivnih narudžbi</Text>
          </View>
        )}
      </ScrollView>

      {/* ── HISTORY MODAL ── */}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <BartenderHistoryScreen
          placeId={placeId ?? ""}
          mySectorIds={mySectorIds}
          sectors={sectors}
          C={C}
          insets={insets}
          onClose={() => setShowHistory(false)}
        />
      </Modal>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={isAdminPreview ? "admin" : "bartender"}
        placeId={placeId ?? ""}
        sectors={sectors}
        currentSectorIds={mySectorIds}
        isAdminPreview={isAdminPreview}
      />

      {/* ── AUDIO MODAL ── */}
      <Modal visible={showAudioModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: darkMode ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.45)" }]}>
          <View style={[styles.modalBox, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: C.modalIconBg, borderColor: C.modalIconBorder }]}>
              <Ionicons name="volume-high" size={28} color={C.accent} />
            </View>
            <Text style={[styles.modalTitle, { color: C.text }]}>Zvuk obavijesti</Text>
            <Text style={[styles.modalBody, { color: C.textSub }]}>
              Omogući zvuk da odmah reagujete na nove narudžbe.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.doneBtn, { marginTop: 0 }, pressed && styles.doneBtnPressed]}
              onPress={unlockAudio}
            >
              <Ionicons name="volume-high" size={18} color={C.white} />
              <Text style={styles.doneBtnText}>OMOGUĆI ZVUK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const makeStyles = (C: AppTheme) => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.bg,
    },

    /* ── HEADER ── */
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    adminBack: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 4,
    },
    adminBackText: {
      fontSize: 12,
      color: C.textMuted,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: C.text,
      letterSpacing: -0.5,
    },
    themeToggle: {
      padding: 8,
      marginRight: 8,
    },
    countBadge: {
      alignItems: "center",
      backgroundColor: C.surfaceHigh,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minWidth: 64,
      borderWidth: 1,
      borderColor: C.border,
    },
    countNum: {
      fontSize: 22,
      fontWeight: "800",
      color: C.text,
      lineHeight: 26,
    },
    countLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: C.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },

    /* ── LIST ── */
    list: {
      padding: 16,
      gap: 12,
    },

    /* ── CONNECTION ── */
    connDot: {
      width: 9, height: 9, borderRadius: 5,
      marginLeft: 2, marginBottom: 1,
    },
    offlineBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: C.danger,
      paddingHorizontal: 16, paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: C.dangerDim,
    },
    offlineBannerText: {
      fontSize: 13, fontWeight: "600", color: "#FFFFFF", flex: 1,
    },

    /* ── AUDIO BUTTON ── */
    doneBtn: {
      height: 54,
      borderRadius: 14,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    doneBtnPressed: { backgroundColor: C.accentDim },
    doneBtnText: { color: C.white, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },

    /* ── EMPTY ── */
    empty: {
      alignItems: "center",
      marginTop: 80,
      gap: 10,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: C.textSub,
    },
    emptySub: {
      fontSize: 14,
      color: C.textMuted,
      fontWeight: "500",
    },

    /* ── MODAL ── */
    modalOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBox: {
      padding: 28,
      borderRadius: 24,
      width: "85%",
      alignItems: "center",
      borderWidth: 1,
      gap: 12,
    },
    modalIcon: {
      width: 60,
      height: 60,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      marginBottom: 4,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
    },
    modalBody: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 4,
    },
});

