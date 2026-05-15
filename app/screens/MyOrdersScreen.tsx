import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useMyOrders } from "../hooks/useMyOrders";

interface Props {
  waiterId: string;
  placeId: string;
  onClose?: () => void;
  darkMode?: boolean;
}


const formatElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export default function MyOrdersScreen({ waiterId, placeId, onClose, darkMode = false }: Props) {
  const { myOrders, timeNow, removeOrder, removeAllDone } = useMyOrders(placeId, waiterId);
  const { primaryColor } = useTheme();
  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");

  const D = {
    root:        darkMode ? "#111827" : "#F4F5F7",
    header:      darkMode ? "#1F2937" : "#fff",
    headerBorder:darkMode ? "#374151" : "#f3f4f6",
    title:       darkMode ? "#F9FAFB" : "#111827",
    closeBtn:    darkMode ? "#374151" : "#f3f4f6",
    closeIcon:   darkMode ? "#9ca3af" : "#6b7280",
    tabBar:      darkMode ? "#1F2937" : "#fff",
    tabBorder:   darkMode ? "#374151" : "#e5e7eb",
    tabText:     darkMode ? "#9ca3af" : "#6b7280",
    card:        darkMode ? "#1F2937" : "#fff",
    pill:        darkMode ? "#374151" : "#f3f4f6",
    pillText:    darkMode ? "#D1D5DB" : "#374151",
    timerChip:   darkMode ? "#374151" : "#f3f4f6",
    timerText:   darkMode ? "#9ca3af" : "#6b7280",
    itemName:    darkMode ? "#F9FAFB" : "#111827",
    qtyText:     darkMode ? "#E5E7EB" : "#374151",
    qtyBorder:   darkMode ? "#4B5563" : "#d1d5db",
    emptyIcon:   darkMode ? "#4B5563" : "#d1d5db",
    emptyTitle:  darkMode ? "#9ca3af" : "#374151",
    emptySubtitle: darkMode ? "#6b7280" : "#9ca3af",
    price:       darkMode ? "#F9FAFB" : primaryColor,
    removeBtnText: darkMode ? "#6b7280" : "#9ca3af",
    clearAllBg:  darkMode ? "#374151" : "#fff",
    clearAllText: darkMode ? "#f87171" : "#ef4444",
  };

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
      const cat = i.category || t("orders.other");
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(i);
    }

    const sectorEntries: [string, string][] = order.sectorStatus
      ? Object.entries(order.sectorStatus as Record<string, string>)
      : [];

    return (
      <View style={[styles.card, isUrgent && styles.cardUrgent, { backgroundColor: D.card }]}>
        {/* Header row */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.indexBadge, { backgroundColor: isPending ? primaryColor : "#22c55e" }]}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            {!!order.region && (
              <View style={[styles.regionPill, { backgroundColor: D.pill }]}>
                <Ionicons name="location-outline" size={12} color={D.pillText} />
                <Text style={[styles.regionText, { color: D.pillText }]}>{order.region}</Text>
              </View>
            )}
          </View>

          {isPending ? (
            <View style={[styles.timerChip, isUrgent && styles.timerChipUrgent, !isUrgent && { backgroundColor: D.timerChip }]}>
              <Ionicons name="time-outline" size={13} color={isUrgent ? "#ef4444" : D.timerText} />
              <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent, !isUrgent && { color: D.timerText }]}>
                {formatElapsed(elapsed)}
              </Text>
            </View>
          ) : (
            <View style={[styles.timerChip, { backgroundColor: "#dcfce7" }]}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#16a34a" />
              <Text style={[styles.timerText, { color: "#16a34a" }]}>
                {t("orders.completedAgo", { time: formatElapsed(elapsed) })}
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
                  <Text style={[styles.itemName, { color: D.itemName }]}>{item.name}</Text>
                  <View style={[styles.qtyBadge, item.qty > 1 ? styles.qtyBadgeRed : [styles.qtyBadgeGray, { borderColor: D.qtyBorder }]]}>
                    <Text style={[styles.qtyText, item.qty > 1 && { color: "#fff" }, item.qty <= 1 && { color: D.qtyText }]}>×{item.qty}</Text>
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
            <Text style={[styles.price, { color: D.price }]}>{order.totalPrice.toFixed(2)} KM</Text>
          )}
          {!isPending && (
            <Pressable style={styles.removeBtn} onPress={() => removeOrder(order.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={14} color={D.removeBtnText} />
              <Text style={[styles.removeBtnText, { color: D.removeBtnText }]}>{t("orders.remove")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: D.root }]}>
      {/* â”€â”€ Header â”€â”€ */}
      <View style={[styles.header, { backgroundColor: D.header, borderBottomColor: D.headerBorder }]}>
        <View style={{ width: 32 }} />
        <Text style={[styles.headerTitle, { color: D.title }]}>{t("orders.myOrders")}</Text>
        {onClose ? (
          <Pressable style={[styles.closeBtn, { backgroundColor: D.closeBtn }]} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={D.closeIcon} />
          </Pressable>
        ) : <View style={{ width: 32 }} />}
      </View>
      <View style={[styles.tabBar, { backgroundColor: D.tabBar, borderBottomColor: D.tabBorder }]}>
        {(["pending", "done"] as const).map(tab => {
          const count = tab === "pending" ? pendingOrders.length : doneOrders.length;
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, { color: D.tabText }, active && styles.tabLabelActive]}>
                {tab === "pending" ? t("orders.pending") : t("orders.done")}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, active ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                  <Text style={[styles.tabBadgeText, active && { color: primaryColor }]}>{count}</Text>
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
            color={D.emptyIcon}
          />
          <Text style={[styles.emptyTitle, { color: D.emptyTitle }]}>
            {activeTab === "pending" ? t("orders.noPending") : t("orders.noDone")}
          </Text>
          <Text style={[styles.emptySubtitle, { color: D.emptySubtitle }]}>
            {activeTab === "pending"
              ? t("orders.pendingHint")
              : t("orders.doneHint")}
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
              <Pressable style={[styles.clearAllBtn, { backgroundColor: D.clearAllBg }]} onPress={removeAllDone}>
                <Ionicons name="trash-outline" size={15} color={D.clearAllText} />
                <Text style={[styles.clearAllText, { color: D.clearAllText }]}>{t("orders.clearAll")}</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
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
  tabBtnActive: { borderBottomColor: p },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  tabLabelActive: { color: p, fontWeight: "700" },
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
  price: { fontSize: 16, fontWeight: "800", color: p },
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

