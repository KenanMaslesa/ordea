import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db, placesRoot } from "../firebase";
import { getItem, setItem } from "./helper";
import useAuth from "./hooks/useAuth";
import { listenOrders, markSectorDone } from "./services/orders.service";
import { Order, Sector } from "./types/order.types";

/* ---------------- THEME ---------------- */
type Theme = "dark" | "light";

const DARK = {
  bg: "#0D0D0F",
  surface: "#18181B",
  surfaceHigh: "#27272A",
  border: "#3F3F46",
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

const LIGHT = {
  bg: "#F4F4F5",
  surface: "#FFFFFF",
  surfaceHigh: "#F1F5F9",
  border: "#E4E4E7",
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
  const [collapsedOther, setCollapsedOther] = useState<Record<string, boolean>>({});

  const soundRef = useRef<Audio.Sound | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");

  const C = useMemo(() => theme === "dark" ? DARK : LIGHT, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setItem("@theme", next);
  };

  /* ---------- LOAD STORAGE ---------- */

  useEffect(() => {
    Promise.all([getItem("@placeId"), getItem("@sectorIds"), getItem("@role"), getItem("@theme")]).then(
      ([pid, sids, role, savedTheme]) => {
        setPlaceId(pid);
        setMySectorIds(sids ? JSON.parse(sids) : []);
        if (role === "admin") setIsAdminPreview(true);
        if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
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
    // Mark each of worker's sectors that appear in this order as done
    const relevantSectors = mySectorIds.filter(sid =>
      order.items.some(i => i.sectorId === sid)
    );
    for (const sid of relevantSectors) {
      await markSectorDone(placeId, order.id, sid, order.items);
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
          {isAdminPreview && (
            <Pressable
              onPress={() => router.replace("/admin")}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={22} color={C.textMuted} />
            </Pressable>
          )}
          <Text style={styles.title}>{headerLabel}</Text>
        </View>
        <Pressable onPress={toggleTheme} style={styles.themeToggle} hitSlop={10}>
          <Ionicons
            name={theme === "dark" ? "sunny-outline" : "moon-outline"}
            size={22}
            color={C.textSub}
          />
        </Pressable>
        <View style={styles.countBadge}>
          <Text style={styles.countNum}>{visibleOrders.length}</Text>
          <Text style={styles.countLabel}>aktivnih</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {visibleOrders.map((o, idx) => {
          const elapsed = Math.floor((timeNow - o.createdAt) / 1000);
          const blink = blinking.includes(o.id);
          const timerColor = urgencyColor(elapsed, C);

          const myItems = mySectorIds.length > 0
            ? o.items.filter(i => mySectorIds.includes(i.sectorId ?? ""))
            : o.items;
          const otherItems = mySectorIds.length > 0
            ? o.items.filter(i => !mySectorIds.includes(i.sectorId ?? ""))
            : [];
          const otherCollapsed = collapsedOther[o.id] !== false;

          const grouped = myItems.reduce<Record<string, typeof myItems>>((acc, item) => {
            const cat = item.category || "Ostalo";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
          }, {});

          return (
            <View
              key={o.id}
              style={[styles.card, blink && styles.cardAlert]}
            >
              {/* ── CARD HEADER ── */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>{idx + 1}</Text>
                  </View>
                  <View>
                    <Text style={styles.waiterName}>{o.waiterName}</Text>
                    {o.region ? (
                      <Text style={styles.regionText}>{o.region}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.timerPill, { borderColor: timerColor }]}>
                  <Ionicons name="time-outline" size={13} color={timerColor} />
                  <Text style={[styles.timerText, { color: timerColor }]}>
                    {formatTime(elapsed)}
                  </Text>
                </View>
              </View>

              {/* ── DIVIDER ── */}
              <View style={styles.divider} />

              {/* ── MY ITEMS ── */}
              {Object.entries(grouped).map(([cat, items]) => (
                <View key={cat} style={styles.categoryBlock}>
                  <Text style={styles.categoryLabel}>{cat.toUpperCase()}</Text>
                  {items.map((item, ii) => (
                    <View key={ii} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <View style={[
                        styles.qtyBadge,
                        item.qty > 1 && styles.qtyBadgeHigh,
                      ]}>
                        <Text style={[
                          styles.qtyText,
                          item.qty > 1 && styles.qtyTextHigh,
                        ]}>
                          ×{item.qty}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {items.filter(i => i.note).map((item, ii) => (
                    <View key={`note-${ii}`} style={styles.itemNote}>
                      <Ionicons name="warning-outline" size={14} color={C.warn} />
                      <Text style={styles.itemNoteText}>{item.note}</Text>
                    </View>
                  ))}
                </View>
              ))}

              {/* ── ORDER NOTE ── */}
              {o.orderNote ? (
                <View style={styles.orderNote}>
                  <Ionicons name="document-text-outline" size={14} color="#93C5FD" />
                  <Text style={styles.orderNoteText}>{o.orderNote}</Text>
                </View>
              ) : null}

              {/* ── OTHER ITEMS ── */}
              {otherItems.length > 0 && (
                <View style={styles.otherSection}>
                  <Pressable
                    onPress={() =>
                      setCollapsedOther(p => ({ ...p, [o.id]: !otherCollapsed }))
                    }
                    style={styles.otherToggle}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={otherCollapsed ? "chevron-forward" : "chevron-down"}
                      size={14}
                      color={C.textMuted}
                    />
                    <Text style={styles.otherToggleText}>
                      Ostale stavke ({otherItems.reduce((s, i) => s + i.qty, 0)})
                    </Text>
                  </Pressable>
                  {!otherCollapsed &&
                    otherItems.map((item, ii) => {
                      const s = sectors.find(x => x.id === item.sectorId);
                      return (
                        <View key={ii} style={styles.otherRow}>
                          <Text style={styles.otherSector}>
                            {s?.name ?? "—"}
                          </Text>
                          <Text style={styles.otherName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.otherQty}>×{item.qty}</Text>
                        </View>
                      );
                    })}
                </View>
              )}

              {/* ── DONE BUTTON ── */}
              {mySectorIds.length > 0 && (
                <Pressable
                  style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
                  onPress={() => handleMarkDone(o)}
                >
                  <Ionicons name="checkmark" size={20} color={C.white} />
                  <Text style={styles.doneBtnText}>ZAVRŠENO</Text>
                </Pressable>
              )}
            </View>
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

      {/* ── AUDIO MODAL ── */}
      <Modal visible={showAudioModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: theme === "dark" ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.45)" }]}>
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

const makeStyles = (C: typeof DARK) => StyleSheet.create({
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

    /* ── CARD ── */
    card: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      ...Platform.select({
        android: { elevation: 4 },
        ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      }),
    },
    cardAlert: {
      borderColor: C.danger,
      backgroundColor: C.cardAlertBg,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    indexBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.surfaceHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    indexText: {
      fontSize: 16,
      fontWeight: "800",
      color: C.textSub,
    },
    waiterName: {
      fontSize: 17,
      fontWeight: "700",
      color: C.text,
    },
    regionText: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 1,
    },
    timerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1.5,
      backgroundColor: "transparent",
    },
    timerText: {
      fontSize: 13,
      fontWeight: "700",
    },

    divider: {
      height: 1,
      backgroundColor: C.border,
      marginBottom: 12,
    },

    /* ── ITEMS ── */
    categoryBlock: {
      marginBottom: 10,
    },
    categoryLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: C.textMuted,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: C.surfaceHigh,
    },
    itemName: {
      fontSize: 18,
      fontWeight: "600",
      color: C.text,
      flex: 1,
      marginRight: 12,
    },
    qtyBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: C.surfaceHigh,
      minWidth: 40,
      alignItems: "center",
    },
    qtyBadgeHigh: {
      backgroundColor: C.dangerDim,
    },
    qtyText: {
      fontSize: 16,
      fontWeight: "800",
      color: C.textSub,
    },
    qtyTextHigh: {
      color: "#FCA5A5",
    },
    itemNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: C.itemNoteBg,
      borderRadius: 8,
      padding: 8,
      marginTop: 6,
      borderWidth: 1,
      borderColor: C.itemNoteBorder,
    },
    itemNoteText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.warn,
      flex: 1,
    },

    /* ── ORDER NOTE ── */
    orderNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: C.orderNoteBg,
      borderRadius: 8,
      padding: 10,
      marginTop: 10,
      borderWidth: 1,
      borderColor: C.orderNoteBorder,
    },
    orderNoteText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.orderNoteText,
      flex: 1,
    },

    /* ── OTHER ITEMS ── */
    otherSection: {
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: 10,
    },
    otherToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    otherToggleText: {
      fontSize: 13,
      color: C.textMuted,
      fontWeight: "600",
    },
    otherRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 5,
      paddingLeft: 4,
    },
    otherSector: {
      fontSize: 11,
      fontWeight: "700",
      color: C.textMuted,
      backgroundColor: C.surfaceHigh,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    otherName: {
      fontSize: 13,
      color: C.textSub,
      flex: 1,
    },
    otherQty: {
      fontSize: 13,
      color: C.textMuted,
      fontWeight: "700",
    },

    /* ── DONE BUTTON ── */
    doneBtn: {
      marginTop: 14,
      height: 54,
      borderRadius: 14,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    doneBtnPressed: {
      backgroundColor: C.accentDim,
    },
    doneBtnText: {
      color: C.white,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.5,
    },

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

