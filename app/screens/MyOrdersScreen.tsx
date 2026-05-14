import { Audio } from "expo-av";
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMyOrders } from "../hooks/useMyOrders";

interface Props {
  waiterId: string;
  placeId: string;
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
};

export default function MyOrdersScreen({ waiterId, placeId }: Props) {
  const { myOrders, timeNow, removeOrder, removeAllDone } =
    useMyOrders(placeId, waiterId);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);

  const filteredOrders = myOrders
  .filter((o) => o.status === activeTab);

  const sortedOrders = [...filteredOrders].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  const renderOrder = (order: any, index: number) => {
    const elapsedSeconds = Math.floor(
      (timeNow -
        (order.status === "done"
          ? order.finishedAt || order.createdAt
          : order.createdAt)) /
        1000
    );

    return (
      <View
        key={order.id}
        style={[
          styles.card,
          {
            borderLeftColor: order.status === "pending" ? "#d32f2f" : "#28a745",
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.index}>#{index + 1}</Text>
          <Text
            style={[
              styles.status,
              { color: order.status === "pending" ? "#d32f2f" : "#28a745" },
            ]}
          >
            {order.status.toUpperCase()}
          </Text>
        </View>

        {order.items.map((i: any, idx: number) => (
          <View key={idx} style={{ marginBottom: 10 }}>
            <View style={styles.row}>
              <Text style={styles.item}>
                {i.category} - {i.name}
              </Text>
              <Text style={[styles.qty, i.qty > 1 && { color: "#d32f2f", fontWeight: "900" }]}>× {i.qty}</Text>
            </View>
            {i.note && (
              <View style={styles.note}>
                <Text style={styles.noteText}>⚠️ {i.note}</Text>
              </View>
            )}
          </View>
        ))}

        {order.orderNote && (
          <View style={styles.orderNote}>
            <Text style={styles.orderNoteText}>📝 {order.orderNote}</Text>
          </View>
        )}

        <Text style={styles.time}>
          {order.status === "done"
            ? `Završeno prije: ${formatTime(elapsedSeconds)}`
            : `Vrijeme od narudžbe: ${formatTime(elapsedSeconds)}`}
        </Text>

        {order.totalPrice != null && (
          <Text style={styles.totalPrice}>
            {order.totalPrice.toFixed(2)} KM
          </Text>
        )}

        {/* Sector status badges */}
        {order.sectorStatus && Object.keys(order.sectorStatus).length > 0 && (
          <View style={styles.sectorBadges}>
            {Object.entries(order.sectorStatus as Record<string, string>).map(([sid, state]) => {
              const label = order.sectorNames?.[sid] ?? sid;
              const done = state === "done";
              return (
                <View
                  key={sid}
                  style={[styles.sectorBadge, done ? styles.sectorBadgeDone : styles.sectorBadgePending]}
                >
                  <Text style={styles.sectorBadgeText}>
                    {label} {done ? "✓" : "⏳"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {order.status === "done" && (
          <Pressable
            style={styles.deleteBtn}
            onPress={() => removeOrder(order.id)}
          >
            <Text style={styles.deleteText}>Obriši</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const pendingCount = myOrders.filter((o) => o.status === "pending").length;
  const doneCount = myOrders.filter((o) => o.status === "done").length;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Moje narudžbe</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "pending" && styles.activeTab]}
          onPress={() => setActiveTab("pending")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "pending" && styles.activeTabText,
            ]}
          >
            Na čekanju ({pendingCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "done" && styles.activeTab]}
          onPress={() => setActiveTab("done")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "done" && styles.activeTabText,
            ]}
          >
            Završene ({doneCount})
          </Text>
        </Pressable>
      </View>

      {/* Orders list */}
      {sortedOrders.length === 0 ? (
        <Text style={styles.empty}>Nema narudžbi</Text>
      ) : (
        <>
          {/* Delete all in Done tab */}
          {activeTab === "done" && doneCount > 0 && (
            <Pressable style={styles.deleteAllBtn} onPress={removeAllDone}>
              <Text style={styles.deleteAllText}>Obriši sve završene</Text>
            </Pressable>
          )}
          <FlatList
            data={sortedOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item, index }) => renderOrder(item, index)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "bold" },

  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  tabText: { fontWeight: "700", color: "#555" },
  activeTab: { backgroundColor: "#0E7C86" },
  activeTabText: { color: "#fff" },

  deleteAllBtn: {
    // backgroundColor: "#f44336",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteAllText: { color: "#f44336", fontWeight: "bold" },

  sectorBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  sectorBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  sectorBadgeDone: { backgroundColor: "#d4edda" },
  sectorBadgePending: { backgroundColor: "#fff3cd" },
  sectorBadgeText: { fontSize: 12, fontWeight: "700" },

  empty: {
    fontStyle: "italic",
    color: "#555",
    textAlign: "center",
    marginTop: 20,
    paddingBottom: 20
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  index: { fontSize: 18, fontWeight: "700" },
  status: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  item: { fontSize: 15, fontWeight: "700" },
  qty: { fontSize: 20, color: "#d32f2f", fontWeight: "700" },
  note: {
    marginTop: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#ffe082",
  },
  noteText: { fontWeight: "700" },
  orderNote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#bbdefb",
  },
  orderNoteText: { fontWeight: "700" },
  time: { marginTop: 8, fontSize: 16, color: "#333" },
  totalPrice: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
    color: "#0E7C86",
    textAlign: "right",
  },
  deleteBtn: {
    marginTop: 12,
    height: 35,
    backgroundColor: "#f44336",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#fff", fontWeight: "700" },
});
