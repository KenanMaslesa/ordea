import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMyOrders } from "../hooks/useMyOrders";

interface Props {
  waiterId: string;
  placeId: string;
  onClose?: () => void;
}

const TEAL = "#0E7C86";

const formatElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export default function MyOrdersScreen({ waiterId, placeId, onClose }: Props) {
  const { myOrders, timeNow, removeOrder, removeAllDone } = useMyOrders(placeId, waiterId);
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");

  const last25h = Date.now() - 25 * 60 * 60 * 1000;

  const pendingOrders = myOrders
    .filter(o => o.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);

  const doneOrders = myOrders
    .filter(o => o.status === "done" && (o.finishedAt ?? o.createdAt) >= last25h)
    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));

  const totalDonePrice = doneOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0);
  const totalPendingPrice = pendingOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0);

  const visibleOrders = activeTab === "pending" ? pendingOrders : doneOrders;

  const renderCard = ({ item: order, index }: { item: any; index: number }) => {
    const isPending = order.status === "pending";
    const refTime = isPending ? order.createdAt : (order.finishedAt ?? order.createdAt);
    const elapsed = timeNow - refTime;
    const isUrgent = isPending && elapsed > 5 * 60 * 1000;

    const grouped: Record<string, any[]> = {};
    for (const i of order.items) {
      const cat = i.category || "Ostalo";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(i);
    }

    const sectorEntries: [string, string][] = order.sectorStatus
      ? Object.entries(order.sectorStatus as Record<string, string>)
      : [];

    return (
      <View style={[styles.card, isUrgent && styles.cardUrgent]}>
        {/* Header row */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.indexBadge, { backgroundColor: isPending ? TEAL : "#22c55e" }]}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            {!!order.region && (
              <View style={styles.regionPill}>
                <Ionicons name="location-outline" size={12} color="#6b7280" />
                <Text style={styles.regionText}>{order.region}</Text>
              </View>
            )}
          </View>

          {isPending ? (
            <View style={[styles.timerChip, isUrgent && styles.timerChipUrgent]}>
              <Ionicons name="time-outline" size={13} color={isUrgent ? "#ef4444" : "#6b7280"} />
              <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
                {formatElapsed(elapsed)}
              </Text>
            </View>
          ) : (
            <View style={[styles.timerChip, { backgroundColor: "#dcfce7" }]}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#16a34a" />
              <Text style={[styles.timerText, { color: "#16a34a" }]}>
                Završeno {formatElapsed(elapsed)} ago
              </Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.itemsSection}>
          {Object.entries(grouped).map(([cat, items]) => (
            <View key={cat} style={styles.categoryGroup}>
              <Text style={styles.categoryLabel}>{cat}</Text>
              {items.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={[styles.qtyBadge, item.qty > 1 ? styles.qtyBadgeRed : styles.qtyBadgeGray]}>
                    <Text style={[styles.qtyText, item.qty > 1 && { color: "#fff" }]}>×{item.qty}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Order note */}
        {!!order.orderNote && (
          <View style={styles.noteRow}>
            <Ionicons name="document-text-outline" size={14} color="#92400e" />
            <Text style={styles.noteText}>{order.orderNote}</Text>
          </View>
        )}

        {/* Sector chips */}
        {sectorEntries.length > 0 && (
          <View style={styles.sectorRow}>
            {sectorEntries.map(([sid, state]) => {
              const label = order.sectorNames?.[sid] ?? sid;
              const done = state === "done";
              return (
                <View key={sid} style={[styles.sectorChip, done ? styles.sectorDone : styles.sectorPending]}>
                  <Ionicons
                    name={done ? "checkmark-circle" : "time-outline"}
                    size={11}
                    color={done ? "#16a34a" : "#d97706"}
                  />
                  <Text style={[styles.sectorChipText, { color: done ? "#16a34a" : "#d97706" }]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          {order.totalPrice != null && (
            <Text style={styles.price}>{order.totalPrice.toFixed(2)} KM</Text>
          )}
          {!isPending && (
            <Pressable style={styles.removeBtn} onPress={() => removeOrder(order.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={14} color="#9ca3af" />
              <Text style={styles.removeBtnText}>Ukloni</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ width: 32 }} />
        <Text style={styles.headerTitle}>Moje narudžbe</Text>
        {onClose ? (
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color="#6b7280" />
          </Pressable>
        ) : <View style={{ width: 32 }} />}
      </View>
      <View style={styles.tabBar}>
        {(["pending", "done"] as const).map(tab => {
          const count = tab === "pending" ? pendingOrders.length : doneOrders.length;
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab === "pending" ? "Na čekanju" : "Završene"}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, active ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                  <Text style={[styles.tabBadgeText, active && { color: TEAL }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {visibleOrders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name={activeTab === "pending" ? "receipt-outline" : "checkmark-done-outline"}
            size={52}
            color="#d1d5db"
          />
          <Text style={styles.emptyTitle}>
            {activeTab === "pending" ? "Nema aktivnih narudžbi" : "Nema završenih narudžbi"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "pending"
              ? "Narudžbe koje pošalješ pojavit će se ovdje"
              : "Završene narudžbe prikazat će se ovdje"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleOrders}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderCard}
          ListFooterComponent={
            activeTab === "done" && doneOrders.length > 0 ? (
              <Pressable style={styles.clearAllBtn} onPress={removeAllDone}>
                <Ionicons name="trash-outline" size={15} color="#ef4444" />
                <Text style={styles.clearAllText}>Obriši sve završene</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F5F7" },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center", justifyContent: "center",
  },

  /* Tabs */
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: TEAL },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  tabLabelActive: { color: TEAL, fontWeight: "700" },
  tabBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  tabBadgeActive: { backgroundColor: "#e0f2f1" },
  tabBadgeInactive: { backgroundColor: "#f3f4f6" },
  tabBadgeText: { fontSize: 11, fontWeight: "800", color: "#6b7280" },

  /* List */
  list: { padding: 16, gap: 12 },

  /* Card */
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8, elevation: 2,
  },
  cardUrgent: { borderWidth: 1.5, borderColor: "#fca5a5" },

  cardTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 8 },

  indexBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  indexText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  regionPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  regionText: { fontSize: 12, fontWeight: "600", color: "#374151" },

  timerChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  timerChipUrgent: { backgroundColor: "#fee2e2" },
  timerText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  timerTextUrgent: { color: "#ef4444", fontWeight: "800" },

  /* Items */
  itemsSection: { gap: 10 },
  categoryGroup: { gap: 4 },
  categoryLabel: {
    fontSize: 10, fontWeight: "700", color: "#9ca3af",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2,
  },
  itemRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 2,
  },
  itemName: { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1 },
  qtyBadge: {
    minWidth: 28, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6, borderWidth: 1,
  },
  qtyBadgeGray: { backgroundColor: "transparent", borderColor: "#d1d5db" },
  qtyBadgeRed: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  qtyText: { fontSize: 12, fontWeight: "700", color: "#374151" },

  /* Note */
  noteRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    marginTop: 10, padding: 8,
    backgroundColor: "#fffbeb", borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: "#fbbf24",
  },
  noteText: { fontSize: 13, color: "#92400e", fontWeight: "600", flex: 1 },

  /* Sector chips */
  sectorRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  sectorChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  sectorDone: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  sectorPending: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  sectorChipText: { fontSize: 11, fontWeight: "700" },

  /* Card footer */
  cardFooter: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "#f3f4f6",
  },
  price: { fontSize: 16, fontWeight: "800", color: TEAL },
  removeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb",
  },
  removeBtnText: { fontSize: 12, fontWeight: "600", color: "#9ca3af" },

  /* Clear all */
  clearAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 4, marginBottom: 12, paddingVertical: 12,
  },
  clearAllText: { fontSize: 14, fontWeight: "700", color: "#ef4444" },

  /* Empty */
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySubtitle: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
});

