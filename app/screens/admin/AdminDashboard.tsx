import { db, ordersPath, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { setItem } from "../../helper";
import { Order, Sector } from "../../types/order.types";

interface Props {
  placeId: string;
}

type Period = "today" | "week" | "month";

function dayKeyFromDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDayKeys(period: Period): string[] {
  const keys: string[] = [];
  const now = new Date();
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(dayKeyFromDate(d));
  }
  return keys;
}

interface Stats {
  revenue: number;
  ordersCount: number;
  cancelledCount: number;
  itemCounts: Record<string, number>;
  waiterRevenue: Record<string, number>;
  regionRevenue: Record<string, number>;
  avgOrderValue: number;
}

function computeStats(orders: Order[]): Stats {
  const done = orders.filter(o => o.status === "done");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const revenue = done.reduce((s, o) => s + (o.totalPrice ?? 0), 0);
  const itemCounts: Record<string, number> = {};
  const waiterRevenue: Record<string, number> = {};
  const regionRevenue: Record<string, number> = {};

  done.forEach(o => {
    waiterRevenue[o.waiterName] = (waiterRevenue[o.waiterName] ?? 0) + (o.totalPrice ?? 0);
    if (o.region) regionRevenue[o.region] = (regionRevenue[o.region] ?? 0) + (o.totalPrice ?? 0);
    o.items?.forEach(item => {
      const key = item.category ? `${item.category} - ${item.name}` : item.name;
      itemCounts[key] = (itemCounts[key] ?? 0) + item.qty;
    });
  });

  return {
    revenue,
    ordersCount: done.length,
    cancelledCount: cancelled.length,
    itemCounts,
    waiterRevenue,
    regionRevenue,
    avgOrderValue: done.length > 0 ? revenue / done.length : 0,
  };
}

export default function AdminDashboard({ placeId }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("today");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);

  useEffect(() => {
    if (!placeId) return;
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), d => {
      if (d.exists()) setSectors((d.data().sectors as Sector[]) ?? []);
    });
    return unsub;
  }, [placeId]);

  const load = useCallback(async () => {
    if (!placeId) return;
    setLoading(true);
    try {
      const keys = getDayKeys(period);
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += 30) chunks.push(keys.slice(i, i + 30));

      let orders: Order[] = [];
      for (const chunk of chunks) {
        const q = query(collection(db, ordersPath(placeId)), where("dayKey", "in", chunk));
        const snap = await getDocs(q);
        snap.forEach(d => orders.push({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
      }
      setStats(computeStats(orders));
    } finally {
      setLoading(false);
    }
  }, [placeId, period]);

  useEffect(() => { load(); }, [load]);

  const topItems = stats
    ? Object.entries(stats.itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    : [];
  const topWaiters = stats
    ? Object.entries(stats.waiterRevenue).sort((a, b) => b[1] - a[1])
    : [];
  const topRegions = stats
    ? Object.entries(stats.regionRevenue).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f5f7" }}>
      {/* Preview role buttons */}
      <View style={styles.previewBar}>
        <Text style={styles.previewLabel}>Pregled kao:</Text>
        <Pressable onPress={() => router.push("/waiter")} style={styles.previewBtn}>
          <Ionicons name="person-outline" size={14} color="#0E7C86" />
          <Text style={styles.previewBtnText}>Konobar</Text>
        </Pressable>
        {sectors.map(s => (
          <Pressable
            key={s.id}
            onPress={async () => {
              await setItem("@sectorIds", JSON.stringify([s.id]));
              router.push("/bartender");
            }}
            style={styles.previewBtn}
          >
            <Ionicons
              name={(s.icon as keyof typeof Ionicons.glyphMap) || "storefront-outline"}
              size={14}
              color="#0E7C86"
            />
            <Text style={styles.previewBtnText}>{s.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.periodRow}>
        {(["today", "week", "month"] as Period[]).map(p => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === "today" ? "Danas" : p === "week" ? "7 dana" : "30 dana"}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#0E7C86" size="large" />
      ) : !stats ? (
        <Text style={styles.empty}>Nema podataka</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: "#0E7C86" }]}>
              <Text style={styles.kpiValue}>{stats.revenue.toFixed(2)} KM</Text>
              <Text style={[styles.kpiLabel, { color: "rgba(255,255,255,0.7)" }]}>Prihod</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#0E7C86" }]}>{stats.ordersCount}</Text>
              <Text style={styles.kpiLabel}>Narudžbi</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#0E7C86" }]}>{stats.avgOrderValue.toFixed(2)}</Text>
              <Text style={styles.kpiLabel}>Pros. KM</Text>
            </View>
            {stats.cancelledCount > 0 && (
              <View style={[styles.kpiCard, { borderColor: "#fee2e2" }]}>
                <Text style={[styles.kpiValue, { color: "#ef4444" }]}>{stats.cancelledCount}</Text>
                <Text style={styles.kpiLabel}>Otkazano</Text>
              </View>
            )}
          </View>

          {topItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Top artikli</Text>
              <View style={styles.card}>
                {topItems.map(([name, qty], i) => (
                  <View key={name} style={[styles.listRow, i < topItems.length - 1 && styles.listRowBorder]}>
                    <Text style={styles.listRank}>{i + 1}.</Text>
                    <Text style={[styles.listName, { flex: 1 }]}>{name}</Text>
                    <Text style={styles.listValue}>{qty}×</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {topWaiters.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Konobari</Text>
              <View style={styles.card}>
                {topWaiters.map(([name, rev], i) => (
                  <View key={name} style={[styles.listRow, i < topWaiters.length - 1 && styles.listRowBorder]}>
                    <Text style={[styles.listName, { flex: 1 }]}>{name}</Text>
                    <Text style={styles.listValue}>{rev.toFixed(2)} KM</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {topRegions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Zone / Stolovi</Text>
              <View style={styles.card}>
                {topRegions.map(([region, rev], i) => (
                  <View key={region} style={[styles.listRow, i < topRegions.length - 1 && styles.listRowBorder]}>
                    <Text style={[styles.listName, { flex: 1 }]}>{region}</Text>
                    <Text style={styles.listValue}>{rev.toFixed(2)} KM</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {stats.ordersCount === 0 && (
            <Text style={styles.empty}>Nema završenih narudžbi za odabrani period.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  previewBar: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#e8f8f9", borderBottomWidth: 1, borderColor: "#b2dfdf",
  },
  previewLabel: { fontSize: 12, fontWeight: "700", color: "#0E7C86" },
  previewBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1,
    borderColor: "#0E7C86", paddingHorizontal: 10, paddingVertical: 5,
  },
  previewBtnText: { fontSize: 12, fontWeight: "600", color: "#0E7C86" },
  periodRow: {
    flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff",
    borderBottomWidth: 1, borderColor: "#eee", alignItems: "center",
  },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd",
  },
  periodBtnActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  periodText: { fontSize: 13, fontWeight: "600", color: "#666" },
  periodTextActive: { color: "#fff" },
  refreshBtn: { marginLeft: "auto", padding: 6 },
  refreshText: { fontSize: 20, color: "#0E7C86" },
  empty: { textAlign: "center", marginTop: 60, color: "#aaa", fontSize: 15 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  kpiCard: {
    flex: 1, minWidth: 90, backgroundColor: "#fff",
    borderRadius: 12, padding: 14, alignItems: "center",
    borderWidth: 1.5, borderColor: "#eee",
  },
  kpiValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  kpiLabel: { fontSize: 11, color: "#aaa", marginTop: 4, fontWeight: "600" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#888", marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  card: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#eee", marginBottom: 16, overflow: "hidden",
  },
  listRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  listRowBorder: { borderBottomWidth: 1, borderColor: "#f5f5f5" },
  listRank: { fontSize: 13, fontWeight: "700", color: "#bbb", width: 22 },
  listName: { fontSize: 14, fontWeight: "600", color: "#333" },
  listValue: { fontSize: 14, fontWeight: "700", color: "#0E7C86" },
});
