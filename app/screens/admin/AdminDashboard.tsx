import { db, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { setItem } from "../../helper";
import {
  aggregateStats,
  getDayKeys,
  getStatsForDays,
} from "../../services/stats.service";
import { Sector } from "../../types/order.types";
import { DayStats } from "../../types/stats.types";

const TEAL = "#0E7C86";
const { width: SW } = Dimensions.get("window");

interface Props { placeId: string }
type Period = "today" | "week" | "month";

/* ─────────── helpers ─────────── */
function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function pctDiff(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

/* ─────────── mini components ─────────── */
function MiniBar({ value, max, color = TEAL }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(value / max, 0.02) : 0;
  return (
    <View style={{ height: 5, backgroundColor: "#f0f0f0", borderRadius: 3, marginTop: 4 }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

function DiffBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: up ? "#dcfce7" : "#fee2e2", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={11} color={up ? "#16a34a" : "#dc2626"} />
      <Text style={{ fontSize: 10, fontWeight: "700", color: up ? "#16a34a" : "#dc2626" }}>
        {up ? "+" : ""}{pct}%
      </Text>
    </View>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginTop: 20, marginBottom: 8, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={{ fontSize: 11, color: "#aaa" }}>{sub}</Text> : null}
    </View>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <View style={[styles.card, { alignItems: "center", paddingVertical: 24 }]}>
      <Text style={{ color: "#ccc", fontSize: 13 }}>{label}</Text>
    </View>
  );
}

/* ─────────── HOURLY HEATMAP ─────────── */
function HourlyHeatmap({ data }: { data: Record<string, number> }) {
  const max = Math.max(...Object.values(data).map(Number), 1);
  const cellW = Math.floor((SW - 64) / 24) - 2;
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", gap: 2, flexWrap: "nowrap" }}>
        {Array.from({ length: 24 }, (_, h) => {
          const count = Number(data[h.toString()] ?? 0);
          const alpha = max > 0 ? 0.08 + (count / max) * 0.9 : 0.05;
          return (
            <View key={h} style={{ alignItems: "center", width: cellW }}>
              <View style={{ width: cellW, height: 32, backgroundColor: `rgba(14,124,134,${alpha.toFixed(2)})`, borderRadius: 3 }} />
              {h % 4 === 0 && (
                <Text style={{ fontSize: 8, color: "#aaa", marginTop: 2 }}>{h}h</Text>
              )}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <Text style={{ fontSize: 10, color: "#aaa" }}>Manje gužve</Text>
        <Text style={{ fontSize: 10, color: "#aaa" }}>Više gužve</Text>
      </View>
    </View>
  );
}

/* ─────────── TREND CHART (per day) ─────────── */
function TrendChart({ daily }: { daily: DayStats[] }) {
  if (daily.length < 2) return null;
  const max = Math.max(...daily.map(d => d.revenue ?? 0), 1);
  const barW = Math.floor((SW - 64) / daily.length) - 3;
  const ordered = [...daily].reverse(); // oldest first
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 64 }}>
        {ordered.map(d => {
          const h = Math.max((d.revenue / max) * 60, 3);
          const label = d.dayKey.slice(5); // MM-DD
          return (
            <View key={d.dayKey} style={{ alignItems: "center", width: barW }}>
              <View style={{ width: barW, height: h, backgroundColor: TEAL, borderRadius: 3, opacity: 0.85 }} />
              {ordered.length <= 14 && (
                <Text style={{ fontSize: 7, color: "#aaa", marginTop: 2 }}>{label}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════ MAIN ═══════════════════════════════════════════════ */
export default function AdminDashboard({ placeId }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("today");
  const [stats, setStats] = useState<DayStats | null>(null);
  const [prevStats, setPrevStats] = useState<DayStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
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
      const days = period === "today" ? 1 : period === "week" ? 7 : 30;
      const keys = getDayKeys(days);
      const prevKeys = getDayKeys(days, days); // same window shifted back

      const [curr, prev, daily] = await Promise.all([
        getStatsForDays(placeId, keys),
        getStatsForDays(placeId, prevKeys),
        Promise.resolve([] as DayStats[]), // already in curr
      ]);

      const allDaily = await getStatsForDays(placeId, keys);
      setDailyStats(allDaily);
      setStats(aggregateStats(curr));
      setPrevStats(aggregateStats(prev));
    } finally {
      setLoading(false);
    }
  }, [placeId, period]);

  useEffect(() => { load(); }, [load]);

  const sectorMap = useMemo(
    () => Object.fromEntries(sectors.map(s => [s.id, s.name])),
    [sectors]
  );

  if (!stats && loading) {
    return <ActivityIndicator style={{ flex: 1, marginTop: 80 }} color={TEAL} size="large" />;
  }

  const avgCompletion = stats && stats.completedForAvg > 0
    ? fmtMs(stats.totalCompletionMs / stats.completedForAvg)
    : null;
  const cancellationRate = stats && (stats.ordersCount + stats.cancelledCount) > 0
    ? ((stats.cancelledCount / (stats.ordersCount + stats.cancelledCount)) * 100).toFixed(1)
    : null;

  const revDiff = stats && prevStats ? pctDiff(stats.revenue, prevStats.revenue) : null;
  const ordersDiff = stats && prevStats ? pctDiff(stats.ordersCount, prevStats.ordersCount) : null;

  const topItems = stats ? Object.entries(stats.itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10) : [];
  const topCategories = stats ? Object.entries(stats.categoryRevenue).sort((a, b) => b[1] - a[1]) : [];
  const topWaiters = stats ? Object.entries(stats.waiterRevenue).sort((a, b) => b[1] - a[1]) : [];
  const topRegions = stats ? Object.entries(stats.regionRevenue).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const sectorEntries = stats ? Object.entries(stats.sectorOrderCount).sort((a, b) => b[1] - a[1]) : [];

  const maxItem = topItems[0]?.[1] ?? 1;
  const maxCat = topCategories[0]?.[1] ?? 1;
  const maxWaiter = topWaiters[0]?.[1] ?? 1;
  const maxRegion = topRegions[0]?.[1] ?? 1;

  const periodLabel = period === "today" ? "jučer" : period === "week" ? "prošlih 7 dana" : "prošlih 30 dana";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f5f7" }}>
      {/* ── PREVIEW BAR ── */}
      <View style={styles.previewBar}>
        <Text style={styles.previewLabel}>Pregled kao:</Text>
        <Pressable onPress={() => router.push("/waiter")} style={styles.previewBtn}>
          <Ionicons name="person-outline" size={14} color={TEAL} />
          <Text style={styles.previewBtnText}>Konobar</Text>
        </Pressable>
        {sectors.map(s => (
          <Pressable
            key={s.id}
            onPress={async () => { await setItem("@sectorIds", JSON.stringify([s.id])); router.push("/bartender"); }}
            style={styles.previewBtn}
          >
            <Ionicons name={(s.icon as any) || "storefront-outline"} size={14} color={TEAL} />
            <Text style={styles.previewBtnText}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── PERIOD TABS ── */}
      <View style={styles.periodRow}>
        {(["today", "week", "month"] as Period[]).map(p => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.periodBtn, period === p && styles.periodBtnActive]}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === "today" ? "Danas" : p === "week" ? "7 dana" : "30 dana"}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={TEAL} />
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={{ position: "absolute", top: 120, alignSelf: "center" }} color={TEAL} />}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ── KPI CARDS ── */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: TEAL }]}>
            <Text style={[styles.kpiValue, { color: "#fff" }]}>{(stats?.revenue ?? 0).toFixed(2)}</Text>
            <Text style={[styles.kpiLabel, { color: "rgba(255,255,255,0.7)" }]}>KM prihod</Text>
            {revDiff !== null && <View style={{ marginTop: 4 }}><DiffBadge pct={revDiff} /></View>}
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: TEAL }]}>{stats?.ordersCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Narudžbi</Text>
            {ordersDiff !== null && <View style={{ marginTop: 4 }}><DiffBadge pct={ordersDiff} /></View>}
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: TEAL }]}>
              {stats && stats.ordersCount > 0 ? (stats.revenue / stats.ordersCount).toFixed(2) : "—"}
            </Text>
            <Text style={styles.kpiLabel}>Pros. KM</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          {avgCompletion && (
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: TEAL, fontSize: 16 }]}>{avgCompletion}</Text>
              <Text style={styles.kpiLabel}>Pros. izrada</Text>
            </View>
          )}
          {cancellationRate !== null && Number(cancellationRate) > 0 && (
            <View style={[styles.kpiCard, { borderColor: "#fee2e2" }]}>
              <Text style={[styles.kpiValue, { color: "#ef4444" }]}>{cancellationRate}%</Text>
              <Text style={styles.kpiLabel}>Otkazano</Text>
            </View>
          )}
          {stats?.cancelledCount ? (
            <View style={[styles.kpiCard, { borderColor: "#fef9c3" }]}>
              <Text style={[styles.kpiValue, { color: "#ca8a04", fontSize: 18 }]}>{stats.cancelledCount}</Text>
              <Text style={styles.kpiLabel}>Otkazane</Text>
            </View>
          ) : null}
        </View>

        {revDiff !== null && (
          <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 }]}>
            <Ionicons name="analytics-outline" size={18} color={TEAL} />
            <Text style={{ fontSize: 12, color: "#555", flex: 1 }}>
              Prihod {revDiff !== null && revDiff >= 0 ? "veći" : "manji"} za{" "}
              <Text style={{ fontWeight: "700" }}>{Math.abs(revDiff ?? 0)}%</Text> u odnosu na {periodLabel}
            </Text>
          </View>
        )}

        {/* ── TREND ── */}
        {period !== "today" && dailyStats.length > 0 && (
          <>
            <SectionTitle title="Trend prihoda" sub={`zadnjih ${dailyStats.length} dana`} />
            <TrendChart daily={dailyStats} />
          </>
        )}

        {/* ── HOURLY HEATMAP ── */}
        <SectionTitle title="Gužva po satu" />
        {stats && Object.keys(stats.hourlyOrderCount).length > 0
          ? <HourlyHeatmap data={stats.hourlyOrderCount} />
          : <EmptyCard label="Nema podataka za ovaj period" />
        }

        {/* ── TOP ITEMS ── */}
        <SectionTitle title="Top artikli" sub="po količini" />
        {topItems.length > 0 ? (
          <View style={styles.card}>
            {topItems.map(([name, qty], i) => (
              <View key={name} style={[styles.row, i < topItems.length - 1 && styles.rowBorder]}>
                <Text style={styles.rank}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.rowVal}>{qty}×</Text>
                  </View>
                  <MiniBar value={qty} max={maxItem} />
                </View>
              </View>
            ))}
          </View>
        ) : <EmptyCard label="Nema prodatih artikala" />}

        {/* ── KATEGORIJE ── */}
        <SectionTitle title="Prihod po kategorijama" />
        {topCategories.length > 0 ? (
          <View style={styles.card}>
            {topCategories.map(([cat, rev], i) => {
              const count = stats?.categoryOrderCount?.[cat] ?? 0;
              return (
                <View key={cat} style={[styles.row, i < topCategories.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={styles.rowName}>{cat}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.rowVal}>{rev.toFixed(2)} KM</Text>
                        <Text style={{ fontSize: 10, color: "#aaa" }}>{count} kom</Text>
                      </View>
                    </View>
                    <MiniBar value={rev} max={maxCat} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyCard label="Nema podataka" />}

        {/* ── KONOBARI ── */}
        <SectionTitle title="Konobari" sub="rang lista" />
        {topWaiters.length > 0 ? (
          <View style={styles.card}>
            {topWaiters.map(([name, rev], i) => {
              const orders = stats?.waiterOrderCount?.[name] ?? 0;
              const totalMs = stats?.waiterTotalCompletionMs?.[name] ?? 0;
              const avgMs = orders > 0 ? totalMs / orders : 0;
              const avgVal = orders > 0 ? (rev / orders).toFixed(2) : "—";
              return (
                <View key={name} style={[styles.row, i < topWaiters.length - 1 && styles.rowBorder]}>
                  <Text style={styles.rank}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.rowName}>{name}</Text>
                      <Text style={[styles.rowVal, { fontSize: 15 }]}>{rev.toFixed(2)} KM</Text>
                    </View>
                    <MiniBar value={rev} max={maxWaiter} />
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                      <Text style={styles.sub}>{orders} narudžbi</Text>
                      <Text style={styles.sub}>Pros. {avgVal} KM</Text>
                      {avgMs > 0 && <Text style={styles.sub}>⏱ {fmtMs(avgMs)}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyCard label="Nema podataka" />}

        {/* ── ZONE / REGIJE ── */}
        {topRegions.length > 0 && (
          <>
            <SectionTitle title="Zone / Regije" sub="po prihodu" />
            <View style={styles.card}>
              {topRegions.map(([region, rev], i) => {
                const count = stats?.regionOrderCount?.[region] ?? 0;
                return (
                  <View key={region} style={[styles.row, i < topRegions.length - 1 && styles.rowBorder]}>
                    <Ionicons name="location-outline" size={14} color="#aaa" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.rowName}>{region}</Text>
                        <Text style={styles.rowVal}>{rev.toFixed(2)} KM</Text>
                      </View>
                      <MiniBar value={rev} max={maxRegion} />
                      <Text style={styles.sub}>{count} narudžbi</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── SEKTORI ── */}
        {sectorEntries.length > 0 && (
          <>
            <SectionTitle title="Sektori" sub="prosječno vrijeme izrade" />
            <View style={styles.card}>
              {sectorEntries.map(([sectorId, count], i) => {
                const totalMs = stats?.sectorTotalCompletionMs?.[sectorId] ?? 0;
                const completed = stats?.sectorCompletedCount?.[sectorId] ?? 0;
                const avgMs = completed > 0 ? totalMs / completed : 0;
                const name = sectorMap[sectorId] ?? sectorId;
                return (
                  <View key={sectorId} style={[styles.row, i < sectorEntries.length - 1 && styles.rowBorder]}>
                    <Ionicons name="storefront-outline" size={15} color="#aaa" />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.rowName}>{name}</Text>
                        {avgMs > 0 && (
                          <Text style={[styles.rowVal, { color: avgMs > 5 * 60_000 ? "#ef4444" : TEAL }]}>
                            ⏱ {fmtMs(avgMs)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.sub}>{count} narudžbi obrađeno</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {!stats?.ordersCount && !loading && (
          <View style={{ alignItems: "center", marginTop: 32 }}>
            <Ionicons name="bar-chart-outline" size={48} color="#ddd" />
            <Text style={{ color: "#bbb", marginTop: 8, fontSize: 14 }}>Nema završenih narudžbi za ovaj period</Text>
            <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>Statistika se puni automatski kako narudžbe budu završene</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────── STYLES ─────────── */
const styles = StyleSheet.create({
  previewBar: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#e8f8f9", borderBottomWidth: 1, borderColor: "#b2dfdf",
  },
  previewLabel: { fontSize: 12, fontWeight: "700", color: TEAL },
  previewBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1,
    borderColor: TEAL, paddingHorizontal: 10, paddingVertical: 5,
  },
  previewBtnText: { fontSize: 12, fontWeight: "600", color: TEAL },
  periodRow: {
    flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff",
    borderBottomWidth: 1, borderColor: "#eee", alignItems: "center",
  },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd",
  },
  periodBtnActive: { backgroundColor: TEAL, borderColor: TEAL },
  periodText: { fontSize: 13, fontWeight: "600", color: "#666" },
  periodTextActive: { color: "#fff" },
  refreshBtn: { marginLeft: "auto", padding: 6 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 14, alignItems: "center",
    borderWidth: 1.5, borderColor: "#eee",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  kpiValue: { fontSize: 20, fontWeight: "800", color: TEAL },
  kpiLabel: { fontSize: 11, color: "#aaa", marginTop: 3, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: "#888", textTransform: "uppercase", letterSpacing: 0.6 },
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "#eee", marginBottom: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "flex-start", padding: 13, gap: 8 },
  rowBorder: { borderBottomWidth: 1, borderColor: "#f5f5f5" },
  rank: { fontSize: 12, fontWeight: "700", color: "#ccc", width: 22, paddingTop: 1 },
  rowName: { fontSize: 13, fontWeight: "600", color: "#222", flex: 1, marginRight: 8 },
  rowVal: { fontSize: 14, fontWeight: "700", color: TEAL },
  sub: { fontSize: 11, color: "#aaa", marginTop: 2 },
});
