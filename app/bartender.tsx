import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db, placesRoot } from "../firebase";
import { getItem } from "./helper";
import useAuth from "./hooks/useAuth";
import { listenOrders, markSectorDone } from "./services/orders.service";
import { Order, Sector } from "./types/order.types";

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

/* ================= SCREEN ================= */

export default function Bartender() {
  useAuth("bartender");

  const router = useRouter();
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
  const blinkAnim = useRef(new Animated.Value(0)).current;

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
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
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

  const headerLabel = mySectors.length > 0
    ? mySectors.map(s => s.name).join(" + ")
    : "ŠANK";

  return (
    <View style={{ flex: 1, backgroundColor: "#f2f2f2" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* HEADER */}
        <View style={styles.header}>
          {isAdminPreview ? (
            <Pressable onPress={() => router.replace("/admin")} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="arrow-back" size={22} color="#111" />
              <Text style={styles.title}>Admin  |  {headerLabel}</Text>
            </Pressable>
          ) : (
            <Text style={styles.title}>{headerLabel}</Text>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{visibleOrders.length} AKTIVNIH</Text>
          </View>
        </View>

        {visibleOrders.map((o, idx) => {
          const elapsed = Math.floor((timeNow - o.createdAt) / 1000);
          const blink = blinking.includes(o.id);

          const myItems = mySectorIds.length > 0
            ? o.items.filter(i => mySectorIds.includes(i.sectorId ?? ""))
            : o.items;
          const otherItems = mySectorIds.length > 0
            ? o.items.filter(i => !mySectorIds.includes(i.sectorId ?? ""))
            : [];
          const otherCollapsed = collapsedOther[o.id] !== false;

          return (
            <Animated.View
              key={o.id}
              style={[styles.card, blink && { backgroundColor: "#b71c1c" }]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.orderIndex}>#{idx + 1}</Text>
                <Text style={styles.waiter}>{o.waiterName}</Text>
              </View>

              {o.region ? <Text style={styles.region}>{o.region}</Text> : null}

              {/* MY ITEMS — grouped by category */}
              {(() => {
                const grouped = myItems.reduce<Record<string, typeof myItems>>((acc, item) => {
                  const cat = item.category || "Ostalo";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {});
                return Object.entries(grouped).map(([cat, items]) => (
                  <View key={cat} style={{ marginTop: 8 }}>
                    <Text style={styles.categoryHeader}>{cat.toUpperCase()}</Text>
                    {items.map((item, ii) => (
                      <View key={ii} style={styles.myItemRow}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.itemName, item.qty > 1 && styles.qtyHighlight]}>• {item.name}</Text>
                          <Text style={[styles.qty, item.qty > 1 && styles.qtyHighlight]}>× {item.qty}</Text>
                        </View>
                        {item.note && (
                          <View style={styles.note}>
                            <Text style={styles.noteText}>⚠️ {item.note}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ));
              })()}

              {/* OTHER ITEMS (collapsed by default) */}
              {otherItems.length > 0 && (
                <View style={styles.otherSection}>
                  <Pressable
                    onPress={() =>
                      setCollapsedOther(p => ({ ...p, [o.id]: !otherCollapsed }))
                    }
                    style={styles.otherToggle}
                  >
                    <Text style={styles.otherToggleText}>
                      {otherCollapsed ? "▶" : "▼"} Ostale stavke ({otherItems.reduce((s, i) => s + i.qty, 0)})
                    </Text>
                  </Pressable>
                  {!otherCollapsed &&
                    otherItems.map((item, ii) => {
                      const s = sectors.find(x => x.id === item.sectorId);
                      return (
                        <View key={ii} style={styles.otherItemRow}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.otherItemName}>
                              {s ? `${s.name} ` : ""}• {item.name}
                            </Text>
                            <Text style={styles.otherItemQty}>× {item.qty}</Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}

              {o.orderNote && (
                <View style={styles.orderNote}>
                  <Text style={styles.noteText}>📝 {o.orderNote}</Text>
                </View>
              )}

              <Text style={styles.time}>⏱ {formatTime(elapsed)}</Text>

              {mySectorIds.length > 0 && (
                <Pressable style={styles.doneBtn} onPress={() => handleMarkDone(o)}>
                  <Text style={styles.doneText}>ZAVRŠENO</Text>
                </Pressable>
              )}
            </Animated.View>
          );
        })}

        {visibleOrders.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nema aktivnih narudžbi ✓</Text>
          </View>
        )}
      </ScrollView>

      {/* AUDIO MODAL */}
      <Modal visible={showAudioModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>
              🔊 Zvuk obavijesti
            </Text>
            <Text style={{ marginVertical: 14, textAlign: "center" }}>
              Omogući zvuk da odmah reagujete na nove narudžbe.
            </Text>
            <Pressable style={styles.doneBtn} onPress={unlockAudio}>
              <Text style={styles.doneText}>OMOGUĆI ZVUK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  adminBackBtn: {
    position: "absolute", top: 12, left: 12, zIndex: 99,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0E7C86", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  adminBackBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  categoryHeader: {
    fontSize: 11,
    fontWeight: "900",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 2,
  },
  qtyHighlight: {
    color: "#d32f2f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "900" },
  badge: {
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { color: "#fff", fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 5,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderIndex: { fontSize: 20, fontWeight: "900" },
  waiter: { fontSize: 18, fontWeight: "800", color: "#28a745" },
  region: { fontSize: 13, color: "#888", marginBottom: 8 },

  myItemRow: { marginBottom: 10, marginTop: 4 },
  itemName: { fontSize: 20, fontWeight: "700", flex: 1 },
  qty: { fontSize: 26, fontWeight: "900" },

  otherSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
  },
  otherToggle: { paddingVertical: 4 },
  otherToggleText: { fontSize: 13, color: "#999", fontWeight: "600" },
  otherItemRow: { marginBottom: 4, paddingLeft: 8 },
  otherItemName: { fontSize: 14, color: "#aaa", flex: 1 },
  otherItemQty: { fontSize: 14, color: "#aaa" },

  note: {
    backgroundColor: "#ffe082",
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  noteText: { fontSize: 16, fontWeight: "700" },

  orderNote: {
    backgroundColor: "#bbdefb",
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },

  time: { fontSize: 16, marginTop: 8, color: "#555" },

  doneBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#28a745",
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#fff", fontSize: 18, fontWeight: "900" },

  emptyState: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 18, color: "#aaa", fontWeight: "600" },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: "85%",
    alignItems: "center",
  },
});

